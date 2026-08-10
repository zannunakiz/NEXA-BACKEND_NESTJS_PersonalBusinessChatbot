import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AuthService, RegisterResponse, Tokens } from './auth.service';
import { JwtAuthGuard, JwtUser } from './jwt-auth.guard';

interface RegisterBody {
  email: string;
  username: string;
  password: string;
  imageUrl?: string;
}

interface LoginBody {
  emailOrUsername: string;
  password: string;
}

interface RequestWithUser extends ExpressRequest {
  user: JwtUser;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(@Body() body: RegisterBody): Promise<RegisterResponse> {
    return this.authService.register(
      body.email,
      body.username,
      body.password,
      body.imageUrl,
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginBody): Promise<RegisterResponse> {
    return this.authService.login(body.emailOrUsername, body.password);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: RequestWithUser): Promise<{ message: string }> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1] ?? '';
    await this.authService.logout(req.user.id, token);
    return { message: 'Logout succeed' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string): Promise<Tokens> {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req: RequestWithUser): Promise<JwtUser> {
    return this.authService.getProfile(req.user.id);
  }
}
