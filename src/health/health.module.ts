import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { OpenrouterModule } from '../openrouter/openrouter.module';
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
    OpenrouterModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}
