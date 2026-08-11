import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CharacteristicController } from './characteristic.controller';
import { CharacteristicService } from './characteristic.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CharacteristicController],
  providers: [CharacteristicService],
  exports: [CharacteristicService],
})
export class CharacteristicModule {}
