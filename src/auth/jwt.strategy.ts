import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { JwtUser } from './jwt-auth.guard';

interface JwtPayload {
  sub: string;
}

interface UserDbRow {
  id: string;
  email: string;
  username: string;
  image_url: string | null;
  created_at: Date;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly redis: RedisService,
  ) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET environment variable is not set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(
    req: { headers: { authorization?: string } },
    payload: JwtPayload,
  ): Promise<JwtUser> {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    const isBlacklisted = await this.redis.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const users = await this.databaseService.executeRead<UserDbRow>(
      'SELECT id, email, username, image_url, created_at FROM users WHERE id = $1 LIMIT 1',
      [payload.sub],
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
}
