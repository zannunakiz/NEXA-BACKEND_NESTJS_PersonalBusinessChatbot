import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { AuthService, RegisterResponse, Tokens } from './auth.service';
import { LoginDto, RefreshTokenDto, RegisterUserDto } from './dto/auth.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard, JwtUser } from './jwt-auth.guard';

interface RequestWithUser extends ExpressRequest {
  user: JwtUser;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() body: RegisterUserDto): Promise<RegisterResponse> {
    return this.authService.register(
      body.email,
      body.username,
      body.password,
      body.imageUrl,
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email or username' })
  async login(@Body() body: LoginDto): Promise<RegisterResponse> {
    return this.authService.login(body.emailOrUsername, body.password);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke the current token' })
  async logout(@Request() req: RequestWithUser): Promise<{ message: string }> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1] ?? '';
    await this.authService.logout(req.user.id, token);
    return { message: 'Logout succeed' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh an expired access token' })
  async refresh(@Body() body: RefreshTokenDto): Promise<Tokens> {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post('password-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate and send a password reset OTP' })
  async requestOtp(@Body() body: RequestOtpDto): Promise<{ message: string }> {
    return this.authService.requestOtp(body.email);
  }

  @Post('password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset the password using an OTP' })
  async resetPassword(
    @Body() body: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(
      body.email,
      body.otp,
      body.newPassword,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  async me(@Request() req: RequestWithUser): Promise<JwtUser> {
    return this.authService.getProfile(req.user.id);
  }
}
