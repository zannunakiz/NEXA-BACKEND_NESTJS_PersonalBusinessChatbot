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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatService, SendMessageResponse } from './chat.service';
import { CreateChatDto, DeleteChatsDto } from './dto/chat.dto';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(':sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a customer chat message and get the AI reply',
  })
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
  @ApiOperation({ summary: 'Delete all chats of a session (by email)' })
  async deleteChats(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: DeleteChatsDto,
  ): Promise<{ message: string }> {
    await this.chatService.deleteChats(sessionId, dto.email);
    return { message: 'All chats for this session deleted successfully' };
  }
}
