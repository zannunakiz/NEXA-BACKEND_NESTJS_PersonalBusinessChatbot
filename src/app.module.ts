import { Module } from '@nestjs/common';
import 'dotenv/config';
import { WinstonModule } from 'nest-winston';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { winstonConfig } from './common/logger/winston.config';

import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';

import { AuthModule } from './auth/auth.module';
import { MasterModule } from './master/master.module';
import { EmailjsModule } from './emailjs/emailjs.module';

@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig),
    DatabaseModule,
    RedisModule,
    HealthModule,
    CloudinaryModule,
    AuthModule,
    MasterModule,
    EmailjsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
