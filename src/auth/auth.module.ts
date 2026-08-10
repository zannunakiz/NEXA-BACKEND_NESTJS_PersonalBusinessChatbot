import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

type DurationString = `${number}${'s' | 'm' | 'h' | 'd'}`;

function toDuration(
  value: string | undefined,
  fallback: DurationString,
): DurationString {
  if (value && /^\d+[smhd]$/.test(value)) {
    return value as DurationString;
  }
  return fallback;
}

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    DatabaseModule,
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: toDuration(
            config.get<string>('JWT_ACCESS_EXPIRES_IN'),
            '30m',
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
