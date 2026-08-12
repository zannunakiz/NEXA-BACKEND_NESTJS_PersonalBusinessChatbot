import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { RedisService } from '../../redis/redis.service';

const CACHE_TTL_SECONDS = 60;
const EXCLUDED_GET_BASES = ['health', 'auth'];
const CACHEABLE_BASES = ['root', 'organization', 'chatbot', 'characteristic'];
const CHILD_CACHE_BASES: Record<string, string[]> = {
  organization: ['chatbot', 'characteristic'],
  chatbot: ['characteristic'],
};

@Injectable()
export class RedisCacheInterceptor<T> implements NestInterceptor<T, unknown> {
  constructor(private readonly redisService: RedisService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: { id?: string } }>();
    const method = request.method;
    const url = request.originalUrl ?? request.url ?? '';
    const userId = request.user?.id ?? 'anon';
    const base = this.extractBase(url);

    if (method === 'GET') {
      if (EXCLUDED_GET_BASES.includes(base)) {
        return next.handle();
      }

      const key = `cache:get:${base}:${url}:${userId}`;
      return from(
        this.redisService.getCache<Record<string, unknown>>(key),
      ).pipe(
        switchMap((cached) => {
          if (cached) {
            return of({ ...cached, redisHit: true });
          }
          return next.handle().pipe(
            map((value) => {
              const payload = this.withRedisHit(value, false);
              this.redisService
                .setCache(key, payload, CACHE_TTL_SECONDS)
                .catch(() => undefined);
              return payload;
            }),
          );
        }),
      );
    }

    if (CACHEABLE_BASES.includes(base)) {
      const patterns = this.patternsForBase(base);
      return next.handle().pipe(
        tap(() => {
          for (const pattern of patterns) {
            this.redisService
              .deleteCacheByPattern(pattern)
              .catch(() => undefined);
          }
        }),
      );
    }

    return next.handle();
  }

  private extractBase(url: string): string {
    const pathname = url.split('?')[0];
    const segments = pathname.split('/').filter((segment) => segment !== '');
    return segments[0] || 'root';
  }

  private patternsForBase(base: string): string[] {
    const bases = [base, ...(CHILD_CACHE_BASES[base] ?? [])];
    return bases.map((item) => `cache:get:${item}:*`);
  }

  private withRedisHit(value: T, hit: boolean): Record<string, unknown> {
    if (typeof value !== 'object' || value === null) {
      return { data: value, redisHit: hit };
    }
    return { ...(value as object), redisHit: hit };
  }
}
