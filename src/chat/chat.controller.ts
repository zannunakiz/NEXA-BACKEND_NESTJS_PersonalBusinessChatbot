import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ChatService, SendMessageResponse } from './chat.service';
import { CreateChatDto, DeleteChatsDto } from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(':sessionId')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CreateChatDto,
  ): Promise<{ message: string; data: SendMessageResponse }> {
    const result = await this.chatService.sendMessage(
      sessionId,
      dto.email,
      dto.customer_chat,
    );
    return { message: 'AI response generated successfully', data: result };
  }

  @Delete(':sessionId')
  async deleteChats(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: DeleteChatsDto,
  ): Promise<{ message: string }> {
    await this.chatService.deleteChats(sessionId, dto.email);
    return { message: 'All chats for this session deleted successfully' };
  }
}
