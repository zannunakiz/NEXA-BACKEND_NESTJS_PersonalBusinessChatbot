import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as crypto from 'crypto';
import Redis from 'ioredis';

@Injectable()
export class RedisService
  extends Redis
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    super({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null, // Allow retry strategy to handle reconnects
      enableOfflineQueue: true,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });

    // Attach early so a first-connect error is never an unhandled 'error' event.
    this.on('error', (err) =>
      this.logger.error('Redis Connection Error:', err),
    );
    this.on('reconnecting', () => this.logger.warn('Redis reconnecting...'));
  }

  onModuleInit() {
    this.on('connect', () => this.logger.log('✅ Connected to Redis !'));
  }

  async onModuleDestroy() {
    await this.quit();
  }

  // Hash token for blacklist
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Blacklist token
  async blacklistToken(token: string, ttlInSeconds: number): Promise<void> {
    const hashed = this.hashToken(token);
    await this.setex(`blacklist:${hashed}`, ttlInSeconds, '1');
  }

  // Check if token is blacklisted
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const hashed = this.hashToken(token);
    const result = await this.get(`blacklist:${hashed}`);
    return result !== null;
  }

  // Save refresh token
  async setRefreshToken(
    userId: string,
    refreshToken: string,
    ttl: number,
  ): Promise<void> {
    await this.setex(`refresh:${userId}`, ttl, refreshToken);
  }

  // Get refresh token
  async getRefreshToken(userId: string): Promise<string | null> {
    return await this.get(`refresh:${userId}`);
  }

  // Delete refresh token
  async deleteRefreshToken(userId: string): Promise<void> {
    await this.del(`refresh:${userId}`);
  }

  // ===================== Generic JSON cache helpers =====================

  async getCache<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setCache(
    key: string,
    value: unknown,
    ttlInSeconds: number,
  ): Promise<void> {
    try {
      await this.setex(key, ttlInSeconds, JSON.stringify(value));
    } catch {
      // ignore write failures
    }
  }

  async deleteCache(key: string): Promise<void> {
    try {
      await this.del(key);
    } catch {
      // ignore
    }
  }

  async deleteCacheByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        await this.del(...keys);
      }
    } catch {
      // ignore
    }
  }

  // ===================== Health check =====================

  /**
   * Performs a Redis health check for the /health endpoint.
   * Returns a Terminus-compatible result object.
   */
  async getHealth(): Promise<
    { redis: { status: 'up' } } | { redis: { status: 'down'; message: string } }
  > {
    try {
      // Ensure a connection attempt is (re)started when needed.
      // 'wait' = not yet connected, 'end' = connection was closed (e.g. after quit()).
      if (this.status === 'wait' || this.status === 'end') {
        this.connect().catch(() => {
          // handled below via timeout / error state
        });
      }

      const result = await Promise.race([
        this.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error('Redis ping timed out (connection unavailable)'),
              ),
            5000,
          ),
        ),
      ]);

      if (result !== 'PONG') {
        return {
          redis: {
            status: 'down',
            message: `Unexpected response: ${String(result)}`,
          },
        };
      }

      return { redis: { status: 'up' } };
    } catch (error) {
      return {
        redis: {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}
