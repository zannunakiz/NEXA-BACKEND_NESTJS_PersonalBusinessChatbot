import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import cluster from 'node:cluster';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

cluster.schedulingPolicy = cluster.SCHED_RR;
const WORKER_COUNT = 5;

async function bootstrap() {
  if (cluster.isPrimary) {
    const logger = new Logger('ClusterMaster');

    logger.log(`🚀 Master Process running on PID: ${process.pid}`);
    logger.log(`Forking ${WORKER_COUNT} Workers...`);
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
    app.useGlobalFilters(new AllExceptionsFilter());

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
