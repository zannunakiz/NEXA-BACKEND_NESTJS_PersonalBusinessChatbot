import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateChatDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Customer chat is required' })
  customer_chat!: string;
}

export class DeleteChatsDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}
