import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import 'multer';
import { v4 as uuidv4 } from 'uuid';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { DatabaseService } from '../database/database.service';
import { CreateChatbotDto, UpdateChatbotDto } from './dto/chatbot.dto';

export interface ChatbotRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  system_prompt: string | null;
  welcome_message: string | null;
  created_by: string;
  updated_by: string;
  created_at: Date;
  updated_at: Date;
}

type ChatbotPatch = Partial<
  Pick<ChatbotRow, 'name' | 'description' | 'system_prompt' | 'welcome_message'>
>;

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async createChatbot(
    organizationId: string,
    userId: string,
    dto: CreateChatbotDto,
    file?: Express.Multer.File,
  ): Promise<ChatbotRow> {
    await this.assertMembership(organizationId, userId);

    let imageUrl: string | null = null;
    if (file) {
      imageUrl = await this.uploadImage(file);
    }

    const chatbotId = uuidv4();

    await this.databaseService.executeWrite(
      `INSERT INTO chatbots (id, organization_id, name, description, image_url, system_prompt, welcome_message, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
      [
        chatbotId,
        organizationId,
        dto.name,
        dto.description ?? null,
        imageUrl,
        dto.systemPrompt ?? null,
        dto.welcomeMessage ?? null,
        userId,
      ],
    );

    return this.getChatbotById(chatbotId);
  }

  async getChatbotsByOrganization(
    organizationId: string,
    userId: string,
  ): Promise<ChatbotRow[]> {
    await this.assertMembership(organizationId, userId);
    return this.databaseService.executeReadMain<ChatbotRow>(
      'SELECT * FROM chatbots WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId],
    );
  }

  async getMyChatbots(
    organizationId: string,
    userId: string,
  ): Promise<ChatbotRow[]> {
    await this.assertMembership(organizationId, userId);
    return this.databaseService.executeReadMain<ChatbotRow>(
      'SELECT * FROM chatbots WHERE organization_id = $1 AND created_by = $2 ORDER BY created_at DESC',
      [organizationId, userId],
    );
  }

  async updateChatbot(
    chatbotId: string,
    userId: string,
    dto: UpdateChatbotDto,
    file?: Express.Multer.File,
  ): Promise<ChatbotRow> {
    const chatbot = await this.getChatbotById(chatbotId);
    await this.assertMembership(chatbot.organization_id, userId);

    const patch = this.buildPatch(dto);
    const replacingImage = file !== undefined && file !== null;

    if (!replacingImage && Object.keys(patch).length === 0) {
      throw new BadRequestException(
        'At least one field (name, description, system_prompt, welcome_message) or an image must be provided',
      );
    }

    let finalImageUrl = chatbot.image_url;
    if (replacingImage) {
      finalImageUrl = await this.uploadImage(file);
      if (chatbot.image_url) {
        await this.cloudinaryService.deleteImage(chatbot.image_url);
      }
    }

    const fields: string[] = [];
    const params: unknown[] = [];
    let index = 1;

    for (const key of Object.keys(patch) as (keyof ChatbotPatch)[]) {
      fields.push(`${key} = $${index}`);
      params.push(patch[key]);
      index += 1;
    }

    if (replacingImage) {
      fields.push(`image_url = $${index}`);
      params.push(finalImageUrl);
      index += 1;
    }

    params.push(userId, chatbotId);
    await this.databaseService.executeWrite(
      `UPDATE chatbots SET ${fields.join(', ')}, updated_by = $${index}, updated_at = CURRENT_TIMESTAMP WHERE id = $${index + 1}`,
      params,
    );

    return this.getChatbotById(chatbotId);
  }

  async deleteChatbot(chatbotId: string, userId: string): Promise<void> {
    const chatbot = await this.getChatbotById(chatbotId);
    await this.assertMembership(chatbot.organization_id, userId);

    if (chatbot.image_url) {
      await this.cloudinaryService.deleteImage(chatbot.image_url);
    }

    await this.databaseService.executeWrite(
      'DELETE FROM chatbots WHERE id = $1',
      [chatbotId],
    );
  }

  private buildPatch(dto: UpdateChatbotDto): ChatbotPatch {
    const patch: ChatbotPatch = {};

    if (dto.name !== undefined) {
      patch.name = dto.name;
    }
    if (dto.description !== undefined) {
      patch.description = dto.description;
    }
    if (dto.systemPrompt !== undefined) {
      patch.system_prompt = dto.systemPrompt;
    }
    if (dto.welcomeMessage !== undefined) {
      patch.welcome_message = dto.welcomeMessage;
    }

    return patch;
  }

  private async uploadImage(file: Express.Multer.File): Promise<string> {
    try {
      const result = await this.cloudinaryService.uploadImage(
        file,
        'NEXA_nestjs/chatbots',
      );
      return result.secure_url;
    } catch (error) {
      this.logger.error(
        `Cloudinary upload failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        'Failed to upload image to Cloudinary. Please try again.',
      );
    }
  }

  private async getChatbotById(chatbotId: string): Promise<ChatbotRow> {
    const rows = await this.databaseService.executeReadMain<ChatbotRow>(
      'SELECT * FROM chatbots WHERE id = $1',
      [chatbotId],
    );
    if (rows.length === 0) {
      throw new NotFoundException('Chatbot not found');
    }
    return rows[0];
  }

  private async assertMembership(
    organizationId: string,
    userId: string,
  ): Promise<string> {
    const rows = await this.databaseService.executeReadMain<{
      id: string;
      role: string;
    }>(
      'SELECT id, role FROM members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId],
    );
    if (rows.length === 0) {
      throw new ForbiddenException('You are not a member of this organization');
    }
    return rows[0].role;
  }
}
