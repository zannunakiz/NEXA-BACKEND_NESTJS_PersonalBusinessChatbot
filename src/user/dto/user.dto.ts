import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(3, 30, { message: 'Username must be between 3 and 30 characters' })
  username?: string;
}
