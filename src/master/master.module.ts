import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [MasterService],
})
export class MasterModule {}
