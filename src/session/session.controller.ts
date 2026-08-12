import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, JwtUser } from '../auth/jwt-auth.guard';
import { CreateSessionDto } from './dto/session.dto';
import { SessionResponse, SessionService } from './session.service';

interface RequestWithUser extends ExpressRequest {
  user: JwtUser;
}

@ApiTags('Session')
@Controller('session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post(':chatbotId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or resume a customer session' })
  async createOrResume(
    @Param('chatbotId', ParseUUIDPipe) chatbotId: string,
    @Body() dto: CreateSessionDto,
  ): Promise<{ message: string; data: SessionResponse }> {
    const result = await this.sessionService.getOrCreateSession(
      chatbotId,
      dto.email,
    );
    const message = result.resumed
      ? 'Session resumed successfully'
      : 'Session created successfully';
    return { message, data: result };
  }

  @Delete('remove/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a session and its chats' })
  async remove(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    await this.sessionService.removeSession(sessionId, req.user.id);
    return { message: 'Session and its chats deleted successfully' };
  }

  @Delete('all/:chatbotId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete all sessions of a chatbot' })
  async removeAll(
    @Param('chatbotId', ParseUUIDPipe) chatbotId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    await this.sessionService.removeAllSessions(chatbotId, req.user.id);
    return { message: 'All sessions and chats deleted successfully' };
  }
}
