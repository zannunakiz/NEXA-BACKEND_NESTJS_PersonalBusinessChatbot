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
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard, JwtUser } from '../auth/jwt-auth.guard';
import {
  CharacteristicRow,
  CharacteristicService,
} from './characteristic.service';
import {
  CreateCharacteristicDto,
  UpdateCharacteristicDto,
} from './dto/characteristic.dto';

interface RequestWithUser extends ExpressRequest {
  user: JwtUser;
}

@Controller('characteristic')
@UseGuards(JwtAuthGuard)
export class CharacteristicController {
  constructor(private readonly characteristicService: CharacteristicService) {}

  @Get(':chatbotId')
  async list(
    @Param('chatbotId', ParseUUIDPipe) chatbotId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string; data: CharacteristicRow[] }> {
    const characteristics =
      await this.characteristicService.listCharacteristics(
        chatbotId,
        req.user.id,
      );
    return {
      message: 'Characteristics retrieved successfully',
      data: characteristics,
    };
  }

  @Get(':chatbotId/:characteristicId')
  async get(
    @Param('chatbotId', ParseUUIDPipe) chatbotId: string,
    @Param('characteristicId', ParseUUIDPipe) characteristicId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string; data: CharacteristicRow }> {
    const characteristic = await this.characteristicService.getCharacteristic(
      chatbotId,
      characteristicId,
      req.user.id,
    );
    return {
      message: 'Characteristic retrieved successfully',
      data: characteristic,
    };
  }

  @Post(':chatbotId')
  async create(
    @Param('chatbotId', ParseUUIDPipe) chatbotId: string,
    @Req() req: RequestWithUser,
    @Body() dto: CreateCharacteristicDto,
  ): Promise<{ message: string; data: CharacteristicRow }> {
    const characteristic =
      await this.characteristicService.createCharacteristic(
        chatbotId,
        req.user.id,
        dto,
      );
    return {
      message: 'Characteristic created successfully',
      data: characteristic,
    };
  }

  @Put(':chatbotId/:characteristicId')
  async update(
    @Param('chatbotId', ParseUUIDPipe) chatbotId: string,
    @Param('characteristicId', ParseUUIDPipe) characteristicId: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateCharacteristicDto,
  ): Promise<{ message: string; data: CharacteristicRow }> {
    const characteristic =
      await this.characteristicService.updateCharacteristic(
        chatbotId,
        characteristicId,
        req.user.id,
        dto,
      );
    return {
      message: 'Characteristic updated successfully',
      data: characteristic,
    };
  }

  @Delete(':chatbotId/:characteristicId')
  async deleteOne(
    @Param('chatbotId', ParseUUIDPipe) chatbotId: string,
    @Param('characteristicId', ParseUUIDPipe) characteristicId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    await this.characteristicService.deleteCharacteristic(
      chatbotId,
      characteristicId,
      req.user.id,
    );
    return { message: 'Characteristic deleted successfully' };
  }

  @Delete(':chatbotId')
  async deleteAll(
    @Param('chatbotId', ParseUUIDPipe) chatbotId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    await this.characteristicService.deleteAllCharacteristics(
      chatbotId,
      req.user.id,
    );
    return { message: 'All characteristics deleted successfully' };
  }
}
