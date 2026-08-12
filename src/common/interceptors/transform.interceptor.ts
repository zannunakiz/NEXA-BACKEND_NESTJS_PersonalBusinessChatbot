import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiSuccessResponse,
  PaginationMeta,
} from '../interfaces/api-response.interface';

interface CustomResponsePayload {
  message?: string;
  data?: unknown;
  pagination?: PaginationMeta;
  redisHit?: boolean;
}

function isCustomResponsePayload(obj: unknown): obj is CustomResponsePayload {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ('data' in obj || 'message' in obj || 'pagination' in obj)
  );
}

function hasRedisHit(res: unknown): res is { redisHit: boolean } {
  return typeof res === 'object' && res !== null && 'redisHit' in res;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<unknown>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<unknown>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers['x-request-id'] as string) ||
      `req_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;

    return next.handle().pipe(
      map((res: T): ApiSuccessResponse<unknown> => {
        let message = 'Operation completed successfully';
        let data: unknown = res;
        let pagination: PaginationMeta | undefined = undefined;

        if (isCustomResponsePayload(res)) {
          if (res.data !== undefined) {
            data = res.data;
          }
          if (typeof res.message === 'string') {
            message = res.message;
          }
          if (res.pagination) {
            pagination = res.pagination;
          }
        }

        const redisHit = hasRedisHit(res) ? res.redisHit : undefined;

        return {
          success: true,
          statusCode: response.statusCode,
          message,
          data,
          ...(pagination ? { pagination } : {}),
          ...(redisHit !== undefined ? { redisHit } : {}),
          meta: {
            timestamp: new Date().toISOString(),
            path: request.url,
            requestId,
          },
        };
      }),
    );
  }
}
