import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OpenrouterModule } from '../openrouter/openrouter.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [DatabaseModule, OpenrouterModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
