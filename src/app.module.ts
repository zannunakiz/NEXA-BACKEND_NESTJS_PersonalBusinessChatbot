import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import 'dotenv/config';
import { Request } from 'express';
import { WinstonModule } from 'nest-winston';
import { ClsModule } from 'nestjs-cls';
import { v4 as uuidv4 } from 'uuid';

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
import { OpenrouterModule } from './openrouter/openrouter.module';
import { RedisModule } from './redis/redis.module';
import { UserModule } from './user/user.module';
import { OrganizationModule } from './organization/organization.module';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: Request) => {
          const existingId = req.headers['x-request-id'];
          const headerValue = Array.isArray(existingId)
            ? existingId[0]
            : existingId;
          return headerValue || uuidv4();
        },
        setup: (cls) => {
          cls.set('requestId', cls.getId());
        },
      },
    }),
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
    UserModule,
    OpenrouterModule,
    OrganizationModule,
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
