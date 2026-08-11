import { IsEmail, IsNotEmpty } from 'class-validator';

export class CreateSessionDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}
