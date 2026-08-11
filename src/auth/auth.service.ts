import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { EmailjsService } from '../emailjs/emailjs.service';
import { RedisService } from '../redis/redis.service';
import { JwtUser } from './jwt-auth.guard';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse {
  user: JwtUser;
  accessToken: string;
  refreshToken: string;
}

interface UserDbRow {
  id: string;
  email: string;
  username: string;
  password_hash?: string;
  image_url: string | null;
  created_at: Date;
}

type DurationString = `${number}${'s' | 'm' | 'h' | 'd'}`;

function toDuration(
  value: string | undefined,
  fallback: DurationString,
): DurationString {
  if (value && /^\d+[smhd]$/.test(value)) {
    return value as DurationString;
  }
  return fallback;
}

const OTP_VALIDITY_MINUTES = 15;
const MIN_PASSWORD_LENGTH = 8;

interface OtpUserDbRow {
  id: string;
  email: string;
  username: string;
  otp_code: string | null;
  otp_expired_at: Date | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly emailjsService: EmailjsService,
  ) {}

  async register(
    email: string,
    username: string,
    password: string,
    imageUrl?: string,
  ): Promise<RegisterResponse> {
    const existing = await this.databaseService.executeRead<UserDbRow>(
      'SELECT id, email, username FROM users WHERE email = $1 OR username = $2 LIMIT 1',
      [email, username],
    );

    if (existing.length > 0) {
      const field = existing[0].email === email ? 'Email' : 'Username';
      throw new ConflictException(`${field} already registered`);
    }

    const hashed = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const createdAt = new Date();
    const avatar = imageUrl ?? null;

    await this.databaseService.executeWrite(
      'INSERT INTO users (id, email, username, password_hash, image_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)',
      [userId, email, username, hashed, avatar, createdAt],
    );

    const user: JwtUser = {
      id: userId,
      email,
      username,
      image_url: avatar,
      created_at: createdAt,
    };

    const tokens = await this.generateTokens(user.id);
    return { user, ...tokens };
  }

  async login(
    emailOrUsername: string,
    password: string,
  ): Promise<RegisterResponse> {
    const users = await this.databaseService.executeRead<UserDbRow>(
      'SELECT id, email, username, password_hash, image_url, created_at FROM users WHERE email = $1 OR username = $1 LIMIT 1',
      [emailOrUsername],
    );

    const userRow = users[0];
    if (!userRow || !userRow.password_hash) {
      throw new UnauthorizedException(
        'Email/Username or password is incorrect',
      );
    }

    const isValid = await bcrypt.compare(password, userRow.password_hash);
    if (!isValid) {
      throw new UnauthorizedException(
        'Email/Username or password is incorrect',
      );
    }

    const tokens = await this.generateTokens(userRow.id);
    const user: JwtUser = {
      id: userRow.id,
      email: userRow.email,
      username: userRow.username,
      image_url: userRow.image_url,
      created_at: userRow.created_at,
    };

    return { user, ...tokens };
  }

  async logout(userId: string, accessToken: string): Promise<void> {
    try {
      const payload = this.jwt.verify<{ sub: string; exp: number }>(
        accessToken,
      );
      const ttl = Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
      if (ttl > 0) {
        await this.redis.blacklistToken(accessToken, ttl);
      }
      await this.redis.deleteRefreshToken(userId);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshToken(refreshToken: string): Promise<Tokens> {
    try {
      const payload = this.jwt.verify<{ sub: string }>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });

      const stored = await this.redis.getRefreshToken(payload.sub);
      if (stored !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const users = await this.databaseService.executeRead<UserDbRow>(
        'SELECT id FROM users WHERE id = $1 LIMIT 1',
        [payload.sub],
      );

      if (users.length === 0) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(users[0].id);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getProfile(userId: string): Promise<JwtUser> {
    const users = await this.databaseService.executeRead<UserDbRow>(
      'SELECT id, email, username, image_url, created_at FROM users WHERE id = $1 LIMIT 1',
      [userId],
    );

    if (users.length === 0) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: users[0].id,
      email: users[0].email,
      username: users[0].username,
      image_url: users[0].image_url,
      created_at: users[0].created_at,
    };
  }

  async requestOtp(email: string): Promise<{ message: string }> {
    const users = await this.databaseService.executeRead<OtpUserDbRow>(
      'SELECT id, email, username FROM users WHERE email = $1 LIMIT 1',
      [email],
    );

    if (users.length === 0) {
      throw new NotFoundException('No account is registered with this email');
    }

    const user = users[0];
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const expiredAt = new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000);

    const sent = await this.emailjsService.sendEmail({
      toEmail: user.email,
      toName: user.username,
      subject: 'Your NEXA password reset code',
      message: `Your password reset code is ${otpCode}. It expires in ${OTP_VALIDITY_MINUTES} minutes.`,
      templateParams: { otp_code: otpCode },
    });

    if (!sent) {
      this.logger.error(`Failed to send OTP email to ${user.email}`);
      throw new InternalServerErrorException(
        'Unable to send the password reset code. Please try again later',
      );
    }

    await this.databaseService.executeWrite(
      'UPDATE users SET otp_code = $1, otp_expired_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [otpCode, expiredAt, user.id],
    );

    return {
      message: `Password reset code sent successfully. It expires in ${OTP_VALIDITY_MINUTES} minutes`,
    };
  }

  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const users = await this.databaseService.executeRead<OtpUserDbRow>(
      'SELECT id, email, otp_code, otp_expired_at FROM users WHERE email = $1 LIMIT 1',
      [email],
    );

    if (users.length === 0) {
      throw new NotFoundException('No account is registered with this email');
    }

    const user = users[0];

    if (!user.otp_code || !user.otp_expired_at) {
      throw new BadRequestException(
        'No password reset code has been requested for this account',
      );
    }

    if (new Date(user.otp_expired_at).getTime() < Date.now()) {
      throw new GoneException('The password reset code has expired');
    }

    if (user.otp_code !== otp) {
      throw new BadRequestException('The password reset code is incorrect');
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.databaseService.executeWrite(
      'UPDATE users SET password_hash = $1, otp_code = NULL, otp_expired_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashed, user.id],
    );

    return { message: 'Password reset successfully' };
  }

  private async generateTokens(userId: string): Promise<Tokens> {
    const payload = { sub: userId };

    const accessExpiresIn = toDuration(
      this.config.get<string>('JWT_ACCESS_EXPIRES_IN'),
      '30m',
    );
    const refreshExpiresIn = toDuration(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN'),
      '7d',
    );
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');

    const accessToken = this.jwt.sign(payload, {
      expiresIn: accessExpiresIn,
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    const refreshTtl = this.parseDurationToSeconds(refreshExpiresIn);
    await this.redis.setRefreshToken(userId, refreshToken, refreshTtl);

    return { accessToken, refreshToken };
  }

  private parseDurationToSeconds(duration: string): number {
    const value = parseInt(duration, 10);
    const unit = duration.replace(/[0-9]/g, '');
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return (multipliers[unit] || 86400) * value;
  }
}
