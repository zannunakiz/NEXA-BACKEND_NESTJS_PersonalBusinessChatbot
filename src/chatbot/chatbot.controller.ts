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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import 'multer';
import { JwtAuthGuard, JwtUser } from '../auth/jwt-auth.guard';
import { ChatbotService, ChatbotRow } from './chatbot.service';
import { CreateChatbotDto, UpdateChatbotDto } from './dto/chatbot.dto';

interface RequestWithUser extends ExpressRequest {
  user: JwtUser;
}

@ApiTags('Chatbot')
@Controller('chatbot')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Get('org/:organizationId')
  @ApiOperation({ summary: 'Get all chatbots of an organization' })
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
  @ApiOperation({ summary: 'Get chatbots created by the current user' })
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
  @ApiOperation({ summary: 'Create a chatbot in an organization' })
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
  @ApiOperation({ summary: 'Update a chatbot' })
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
  @ApiOperation({ summary: 'Delete a chatbot' })
  async delete(
    @Param('chatbotId', ParseUUIDPipe) chatbotId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    await this.chatbotService.deleteChatbot(chatbotId, req.user.id);
    return { message: 'Chatbot deleted successfully' };
  }
}
