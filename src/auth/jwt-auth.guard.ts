import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export interface JwtUser {
  id: string;
  email: string;
  username: string;
  image_url: string | null;
  created_at: Date;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: unknown,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    info: unknown,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: ExecutionContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    status?: unknown,
  ): TUser {
    if (err) {
      throw err instanceof Error
        ? err
        : new UnauthorizedException('Unauthorized');
    }
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }
    return user as TUser;
  }
}
