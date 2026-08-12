import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import { NextFunction, Request, Response } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ClsService } from 'nestjs-cls';
import cluster from 'node:cluster';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RedisCacheInterceptor } from './common/interceptors/redis-cache.interceptor';
import { RedisService } from './redis/redis.service';

cluster.schedulingPolicy = cluster.SCHED_RR;
const WORKER_COUNT = 5;

async function bootstrap() {
  if (cluster.isPrimary) {
    const logger = new Logger('ClusterMaster');

    logger.log(`🚀 Master Process running on PID: ${process.pid}`);
    logger.log(`Forking ${WORKER_COUNT} Worker...`);
    console.log('Server is running on http://localhost:3000');
    console.log('Health at http://localhost:3000/health');

    for (let i = 0; i < WORKER_COUNT; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      logger.warn(
        `⚠️ Worker PID ${worker.process.pid} died (code: ${code}, signal: ${signal}). Forking replacement...`,
      );
      cluster.fork();
    });
  } else {
    const app = await NestFactory.create(AppModule);

    app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

    // Global Validation Pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    );

    // Global Response Interceptor & Exception Filter
    const redisService = app.get(RedisService);
    app.useGlobalInterceptors(
      new TransformInterceptor(),
      new RedisCacheInterceptor(redisService),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    const httpLogger = new Logger('HTTP');
    const clsService = app.get(ClsService);

    app.use((req: Request, res: Response, next: NextFunction) => {
      const { method, originalUrl } = req;
      const startTime = Date.now();

      res.on('finish', () => {
        const requestId = clsService.getId() || 'N/A';

        const { statusCode } = res;
        const duration = Date.now() - startTime;
        const errorMessage = res.locals.errorMessage
          ? ` | Error: ${res.locals.errorMessage}`
          : '';

        const logMessage = `[${requestId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms${errorMessage}`;

        if (statusCode >= 500) {
          httpLogger.error(logMessage);
        } else if (statusCode >= 400) {
          httpLogger.warn(logMessage);
        } else {
          httpLogger.log(logMessage);
        }
      });

      next();
    });

    const port = process.env.PORT || 3000;
    await app.listen(port);

    const workerLogger = new Logger('ClusterWorker');
    workerLogger.log(
      `⚙️ Worker Process listening on port ${port} | PID: ${process.pid}`,
    );
  }
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
