import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailjsService } from './emailjs.service';

@Module({
  imports: [ConfigModule],
  providers: [EmailjsService],
  exports: [EmailjsService],
})
export class EmailjsModule {}
