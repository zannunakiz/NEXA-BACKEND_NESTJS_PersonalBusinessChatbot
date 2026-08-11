import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const CHARACTERISTIC_TYPES = ['data', 'restrict'] as const;

export type CharacteristicType = (typeof CHARACTERISTIC_TYPES)[number];

export class CreateCharacteristicDto {
  @IsIn(CHARACTERISTIC_TYPES)
  type!: CharacteristicType;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateCharacteristicDto {
  @IsIn(CHARACTERISTIC_TYPES)
  @IsOptional()
  type?: CharacteristicType;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
