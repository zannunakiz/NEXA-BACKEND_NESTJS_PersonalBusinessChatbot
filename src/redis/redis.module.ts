import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global() // biar bisa dipakai di mana saja tanpa import ulang
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
