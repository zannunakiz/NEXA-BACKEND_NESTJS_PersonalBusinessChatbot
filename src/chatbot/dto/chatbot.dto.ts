import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateChatbotDto {
  @IsUUID()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @IsString()
  @IsOptional()
  welcomeMessage?: string;
}

export class UpdateChatbotDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @IsString()
  @IsOptional()
  welcomeMessage?: string;
}
