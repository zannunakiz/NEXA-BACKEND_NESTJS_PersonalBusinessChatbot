import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { v2 as cloudinary } from 'cloudinary';
import cluster from 'node:cluster';
import { DatabaseService } from '../database/database.service';
import { EmailjsService } from '../emailjs/emailjs.service';
import { RedisService } from '../redis/redis.service';

interface CloudinaryPingResponse {
  status: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly emailjsService: EmailjsService,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult & { worker: string }> {
    const healthResult = await this.health.check([
      async () => {
        try {
          await this.databaseService.ping(process.env.NEONDB_MAIN_URL || '');
          return { neondb_main: { status: 'up' } };
        } catch (error) {
          return {
            neondb_main: {
              status: 'down',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          };
        }
      },

      async () => {
        try {
          await this.databaseService.ping(
            process.env.NEONDB_DUPLICATE_URL || '',
          );
          return { neondb_duplicate: { status: 'up' } };
        } catch (error) {
          return {
            neondb_duplicate: {
              status: 'down',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          };
        }
      },

      async () => {
        try {
          await this.databaseService.ping(process.env.NEONDB_BACKUP_URL || '');
          return { neondb_backup: { status: 'up' } };
        } catch (error) {
          return {
            neondb_backup: {
              status: 'down',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          };
        }
      },

      async () => this.redisService.getHealth(),

      async () => {
        try {
          const res = (await cloudinary.api.ping()) as CloudinaryPingResponse;
          if (res?.status === 'ok') {
            return { cloudinary: { status: 'up' } };
          }
          return {
            cloudinary: {
              status: 'down',
              message: `Unexpected response status: ${String(res?.status)}`,
            },
          };
        } catch (error) {
          return {
            cloudinary: {
              status: 'down',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          };
        }
      },

      async () => {
        const emailjsCheck = await this.emailjsService.ping();
        if (emailjsCheck.status === 'up') {
          return { emailjs: { status: 'up' } };
        }
        return {
          emailjs: {
            status: 'down',
            message: emailjsCheck.message || 'EmailJS service unreachable',
          },
        };
      },

      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),

      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
    ]);

    return {
      ...healthResult,
      worker: `Worker PID: ${process.pid} (Worker ID: ${cluster.worker?.id ?? 'Standalone'})`,
    };
  }
}
