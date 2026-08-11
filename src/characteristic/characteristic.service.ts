import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import {
  CharacteristicType,
  CreateCharacteristicDto,
  UpdateCharacteristicDto,
} from './dto/characteristic.dto';

export interface CharacteristicRow {
  id: string;
  chatbot_id: string;
  created_by: string;
  updated_by: string;
  type: CharacteristicType;
  title: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class CharacteristicService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createCharacteristic(
    chatbotId: string,
    userId: string,
    dto: CreateCharacteristicDto,
  ): Promise<CharacteristicRow> {
    await this.assertMembership(chatbotId, userId);

    const characteristicId = uuidv4();

    await this.databaseService.executeWrite(
      `INSERT INTO characteristics (id, chatbot_id, created_by, updated_by, type, title, description)
       VALUES ($1, $2, $3, $3, $4, $5, $6)`,
      [
        characteristicId,
        chatbotId,
        userId,
        dto.type,
        dto.title,
        dto.description ?? null,
      ],
    );

    return this.getCharacteristic(chatbotId, characteristicId, userId);
  }

  async listCharacteristics(
    chatbotId: string,
    userId: string,
  ): Promise<CharacteristicRow[]> {
    await this.assertMembership(chatbotId, userId);
    return this.databaseService.executeReadMain<CharacteristicRow>(
      'SELECT * FROM characteristics WHERE chatbot_id = $1 ORDER BY created_at ASC',
      [chatbotId],
    );
  }

  async getCharacteristic(
    chatbotId: string,
    characteristicId: string,
    userId: string,
  ): Promise<CharacteristicRow> {
    await this.assertMembership(chatbotId, userId);
    const rows = await this.databaseService.executeReadMain<CharacteristicRow>(
      'SELECT * FROM characteristics WHERE id = $1 AND chatbot_id = $2',
      [characteristicId, chatbotId],
    );
    if (rows.length === 0) {
      throw new NotFoundException('Characteristic not found');
    }
    return rows[0];
  }

  async updateCharacteristic(
    chatbotId: string,
    characteristicId: string,
    userId: string,
    dto: UpdateCharacteristicDto,
  ): Promise<CharacteristicRow> {
    await this.assertMembership(chatbotId, userId);
    await this.getCharacteristic(chatbotId, characteristicId, userId);

    if (
      dto.type === undefined &&
      dto.title === undefined &&
      dto.description === undefined
    ) {
      throw new BadRequestException(
        'At least one field (type, title, description) must be provided',
      );
    }

    const fields: string[] = [];
    const params: unknown[] = [];
    let index = 1;

    if (dto.type !== undefined) {
      fields.push(`type = $${index}`);
      params.push(dto.type);
      index += 1;
    }
    if (dto.title !== undefined) {
      fields.push(`title = $${index}`);
      params.push(dto.title);
      index += 1;
    }
    if (dto.description !== undefined) {
      fields.push(`description = $${index}`);
      params.push(dto.description);
      index += 1;
    }

    params.push(userId, chatbotId, characteristicId);
    await this.databaseService.executeWrite(
      `UPDATE characteristics SET ${fields.join(', ')}, updated_by = $${index}, updated_at = CURRENT_TIMESTAMP WHERE id = $${index + 1} AND chatbot_id = $${index + 2}`,
      params,
    );

    return this.getCharacteristic(chatbotId, characteristicId, userId);
  }

  async deleteCharacteristic(
    chatbotId: string,
    characteristicId: string,
    userId: string,
  ): Promise<void> {
    await this.assertMembership(chatbotId, userId);
    await this.getCharacteristic(chatbotId, characteristicId, userId);
    await this.databaseService.executeWrite(
      'DELETE FROM characteristics WHERE id = $1 AND chatbot_id = $2',
      [characteristicId, chatbotId],
    );
  }

  async deleteAllCharacteristics(
    chatbotId: string,
    userId: string,
  ): Promise<void> {
    await this.assertMembership(chatbotId, userId);
    await this.databaseService.executeWrite(
      'DELETE FROM characteristics WHERE chatbot_id = $1',
      [chatbotId],
    );
  }

  private async assertMembership(
    chatbotId: string,
    userId: string,
  ): Promise<void> {
    const chatbotRows = await this.databaseService.executeReadMain<{
      organization_id: string;
    }>('SELECT organization_id FROM chatbots WHERE id = $1', [chatbotId]);

    if (chatbotRows.length === 0) {
      throw new NotFoundException('Chatbot not found');
    }

    const memberRows = await this.databaseService.executeReadMain<{
      id: string;
    }>('SELECT id FROM members WHERE organization_id = $1 AND user_id = $2', [
      chatbotRows[0].organization_id,
      userId,
    ]);

    if (memberRows.length === 0) {
      throw new ForbiddenException('You are not a member of this organization');
    }
  }
}
