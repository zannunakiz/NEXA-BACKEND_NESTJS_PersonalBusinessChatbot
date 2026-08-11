import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request as ExpressRequest } from 'express';
import 'multer';
import { JwtAuthGuard, JwtUser } from '../auth/jwt-auth.guard';
import { ChatbotService, ChatbotRow } from './chatbot.service';
import { CreateChatbotDto, UpdateChatbotDto } from './dto/chatbot.dto';

interface RequestWithUser extends ExpressRequest {
  user: JwtUser;
}

@Controller('chatbot')
@UseGuards(JwtAuthGuard)
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Get('org/:organizationId')
  async getByOrganization(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string; data: ChatbotRow[] }> {
    const chatbots = await this.chatbotService.getChatbotsByOrganization(
      organizationId,
      req.user.id,
    );
    return {
      message: 'Chatbots retrieved successfully',
      data: chatbots,
    };
  }

  @Get('me/:organizationId')
  async getMyChatbots(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string; data: ChatbotRow[] }> {
    const chatbots = await this.chatbotService.getMyChatbots(
      organizationId,
      req.user.id,
    );
    return {
      message: 'My chatbots retrieved successfully',
      data: chatbots,
    };
  }

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateChatbotDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ message: string; data: ChatbotRow }> {
    const chatbot = await this.chatbotService.createChatbot(
      dto.organizationId,
      req.user.id,
      dto,
      file,
    );
    return { message: 'Chatbot created successfully', data: chatbot };
  }

  @Put(':chatbotId')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('chatbotId', ParseUUIDPipe) chatbotId: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateChatbotDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ message: string; data: ChatbotRow }> {
    const chatbot = await this.chatbotService.updateChatbot(
      chatbotId,
      req.user.id,
      dto,
      file,
    );
    return { message: 'Chatbot updated successfully', data: chatbot };
  }

  @Delete(':chatbotId')
  async delete(
    @Param('chatbotId', ParseUUIDPipe) chatbotId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    await this.chatbotService.deleteChatbot(chatbotId, req.user.id);
    return { message: 'Chatbot deleted successfully' };
  }
}
