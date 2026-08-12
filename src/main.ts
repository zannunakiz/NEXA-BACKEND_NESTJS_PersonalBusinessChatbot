import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import 'dotenv/config';
import { NextFunction, Request, Response } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ClsService } from 'nestjs-cls';
import cluster from 'node:cluster';
import { Server } from 'node:http';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RedisCacheInterceptor } from './common/interceptors/redis-cache.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RedisService } from './redis/redis.service';

cluster.schedulingPolicy = cluster.SCHED_RR;
const WORKER_COUNT = 5;

async function bootstrap() {
  if (cluster.isPrimary) {
    const logger = new Logger('ClusterMaster');

    logger.log(`🚀 Master Process running on PID: ${process.pid}`);
    logger.log(`Forking ${WORKER_COUNT} Worker...`);
    console.log('');
    console.log('');
    console.log('Server is running on http://localhost:3000');
    console.log('Health at http://localhost:3000/health');
    console.log('Swagger UI: http://localhost:3000/api');
    console.log('OpenAPI JSON: http://localhost:3000/api-json');
    console.log('');

    for (let i = 0; i < WORKER_COUNT; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      logger.warn(
        `⚠️ Worker PID ${worker.process.pid} died (code: ${code}, signal: ${signal}). Forking replacement...`,
      );
      cluster.fork();
    });

    const shutdownMaster = () => {
      logger.log('🛑 Master received shutdown signal, stopping workers...');
      for (const id of Object.keys(cluster.workers ?? {})) {
        cluster.workers?.[id]?.kill('SIGTERM');
      }
      setTimeout(() => process.exit(0), 2000).unref();
    };
    process.on('SIGTERM', shutdownMaster);
    process.on('SIGINT', shutdownMaster);
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

    // Swagger / OpenAPI Documentation
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NEXA API')
      .setDescription(
        'NEXA chatbot API - comprehensive REST documentation for all modules.',
      )
      .setVersion('1.0.0')
      .addTag('Auth', 'Authentication and account management')
      .addTag('User', 'User profile management')
      .addTag('Organization', 'Organizations and members')
      .addTag('Chatbot', 'Chatbot management')
      .addTag('Characteristic', 'Chatbot characteristics')
      .addTag('Session', 'Customer chat sessions')
      .addTag('Chat', 'Customer chat messages')
      .addTag('Health', 'System health')
      .addTag('Master', 'Administrative operations')
      .addBearerAuth()
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, swaggerDocument);

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

    const shutdownLogger = new Logger('Shutdown');
    const server = app.getHttpServer() as unknown as Server;
    let isShuttingDown = false;

    const gracefulShutdown = async (signal: string): Promise<void> => {
      if (isShuttingDown) {
        return;
      }
      isShuttingDown = true;
      shutdownLogger.log(`🛑 Received ${signal}, shutting down gracefully`);

      const forceTimer = setTimeout(() => {
        shutdownLogger.error('Forced exit after shutdown timeout');
        process.exit(1);
      }, 10000);
      forceTimer.unref();

      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        const closeable = server as unknown as {
          closeAllConnections?: () => void;
          closeIdleConnections?: () => void;
        };
        closeable.closeAllConnections?.();
        closeable.closeIdleConnections?.();
      });

      try {
        await app.close();
        shutdownLogger.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        shutdownLogger.error(
          `Failed during shutdown: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
  }
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
