import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ArcjetService } from './arcjet.service';

@Injectable()
export class ArcjetGuard implements CanActivate {
  private readonly logger = new Logger(ArcjetGuard.name);

  constructor(private readonly arcjetService: ArcjetService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const decision = await this.arcjetService.protect(req);

    if (!decision) {
      return true;
    }

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        this.logger.warn(
          `🚫 Rate limit exceeded for IP: ${req.ip ?? 'unknown'}`,
        );
        throw new HttpException(
          'Too Many Requests',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (decision.reason.isBot()) {
        this.logger.warn(
          `🤖 Bot detected and blocked for IP: ${req.ip ?? 'unknown'}`,
        );
        throw new HttpException(
          'Forbidden: Bot Detected',
          HttpStatus.FORBIDDEN,
        );
      }

      if (decision.reason.isShield()) {
        this.logger.warn(
          `🛡️ Shield blocked suspicious request for IP: ${req.ip ?? 'unknown'}`,
        );
        throw new HttpException(
          'Forbidden: Suspicious Request',
          HttpStatus.FORBIDDEN,
        );
      }

      throw new HttpException('Access Denied', HttpStatus.FORBIDDEN);
    }

    return true;
  }
}
