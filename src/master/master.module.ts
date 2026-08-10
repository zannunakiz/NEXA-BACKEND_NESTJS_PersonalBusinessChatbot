import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { DatabaseModule } from '../database/database.module';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';

@Module({
  imports: [DatabaseModule, CloudinaryModule],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [MasterService],
})
export class MasterModule {}
