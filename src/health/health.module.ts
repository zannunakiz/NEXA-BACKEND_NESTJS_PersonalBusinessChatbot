import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from '../database/database.module';
import { EmailjsModule } from '../emailjs/emailjs.module';
import { RedisModule } from '../redis/redis.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule,
    TerminusModule,
    DatabaseModule,
    RedisModule,
    EmailjsModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}
