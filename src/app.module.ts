import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import 'dotenv/config';
import { WinstonModule } from 'nest-winston';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { winstonConfig } from './common/logger/winston.config';

import { ArcjetGuard } from './arcjet/arcjet.guard';
import { CustomArcjetModule } from './arcjet/arcjet.module';
import { AuthModule } from './auth/auth.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { DatabaseModule } from './database/database.module';
import { EmailjsModule } from './emailjs/emailjs.module';
import { HealthModule } from './health/health.module';
import { MasterModule } from './master/master.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    WinstonModule.forRoot(winstonConfig),
    DatabaseModule,
    RedisModule,
    HealthModule,
    CloudinaryModule,
    AuthModule,
    MasterModule,
    EmailjsModule,
    CustomArcjetModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ArcjetGuard,
    },
  ],
})
export class AppModule {}
