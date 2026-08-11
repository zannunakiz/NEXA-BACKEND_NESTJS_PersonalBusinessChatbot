import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export interface SessionRow {
  id: string;
  organization_id: string;
  chatbot_id: string;
  start_session_date: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ChatRow {
  id: string;
  session_id: string;
  chatbot_id: string;
  ai_chat: string;
  customer_chat: string;
  created_at: Date;
}

export interface ChatbotInfo {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  system_prompt: string | null;
  welcome_message: string | null;
}

export interface CharacteristicInfo {
  id: string;
  type: string;
  title: string;
  description: string | null;
}

export interface SessionResponse {
  resumed: boolean;
  session: SessionRow;
  chatbot: ChatbotInfo;
  characteristics: CharacteristicInfo[];
  chats: ChatRow[];
}

@Injectable()
export class SessionService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async getOrCreateSession(
    chatbotId: string,
    email: string,
  ): Promise<SessionResponse> {
    const secret = this.getEmailSecret();

    const chatbotRows = await this.databaseService.executeReadMain<ChatbotInfo>(
      `SELECT id, organization_id, name, description, image_url, system_prompt, welcome_message
       FROM chatbots WHERE id = $1`,
      [chatbotId],
    );

    if (chatbotRows.length === 0) {
      throw new NotFoundException('Chatbot not found');
    }
    const chatbot = chatbotRows[0];

    const characteristics =
      await this.databaseService.executeReadMain<CharacteristicInfo>(
        'SELECT id, type, title, description FROM characteristics WHERE chatbot_id = $1',
        [chatbotId],
      );

    if (characteristics.length === 0) {
      throw new BadRequestException(
        'Chatbot is inactive because it has no characteristics',
      );
    }

    const existing = await this.databaseService.executeReadMain<SessionRow>(
      `SELECT id, organization_id, chatbot_id, start_session_date, created_at, updated_at
       FROM sessions
       WHERE chatbot_id = $1 AND pgp_sym_decrypt(customer_email_encrypted, $2) = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [chatbotId, secret, email],
    );

    if (existing.length > 0) {
      const session = existing[0];
      const chats = await this.getChatsForSession(session.id);
      return { resumed: true, session, chatbot, characteristics, chats };
    }

    const sessionId = uuidv4();
    await this.databaseService.executeWrite(
      `INSERT INTO sessions (id, organization_id, chatbot_id, customer_email_encrypted)
       VALUES ($1, $2, $3, pgp_sym_encrypt($4, $5))`,
      [sessionId, chatbot.organization_id, chatbotId, email, secret],
    );

    const session = await this.getSessionById(sessionId);
    return { resumed: false, session, chatbot, characteristics, chats: [] };
  }

  async removeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSessionById(sessionId);
    await this.assertMembership(session.organization_id, userId);
    await this.databaseService.executeWrite(
      'DELETE FROM sessions WHERE id = $1',
      [sessionId],
    );
  }

  async removeAllSessions(chatbotId: string, userId: string): Promise<void> {
    const chatbotRows = await this.databaseService.executeReadMain<{
      organization_id: string;
    }>('SELECT organization_id FROM chatbots WHERE id = $1', [chatbotId]);

    if (chatbotRows.length === 0) {
      throw new NotFoundException('Chatbot not found');
    }
    await this.assertMembership(chatbotRows[0].organization_id, userId);

    await this.databaseService.executeWrite(
      'DELETE FROM sessions WHERE chatbot_id = $1',
      [chatbotId],
    );
  }

  async getChatsForSession(sessionId: string): Promise<ChatRow[]> {
    return this.databaseService.executeReadMain<ChatRow>(
      'SELECT id, session_id, chatbot_id, ai_chat, customer_chat, created_at FROM chats WHERE session_id = $1 ORDER BY created_at DESC',
      [sessionId],
    );
  }

  async getSessionById(sessionId: string): Promise<SessionRow> {
    const rows = await this.databaseService.executeReadMain<SessionRow>(
      'SELECT id, organization_id, chatbot_id, start_session_date, created_at, updated_at FROM sessions WHERE id = $1',
      [sessionId],
    );
    if (rows.length === 0) {
      throw new NotFoundException('Session not found');
    }
    return rows[0];
  }

  private getEmailSecret(): string {
    return (
      this.config.get<string>('CUSTOMER_EMAIL_SECRET') ||
      'nexa-customer-email-secret'
    );
  }

  private async assertMembership(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const rows = await this.databaseService.executeReadMain<{ id: string }>(
      'SELECT id FROM members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId],
    );
    if (rows.length === 0) {
      throw new ForbiddenException('You are not a member of this organization');
    }
  }
}
