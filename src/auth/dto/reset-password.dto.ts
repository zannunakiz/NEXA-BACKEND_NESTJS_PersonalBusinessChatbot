import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString({ message: 'OTP must be a string' })
  @Length(6, 6, { message: 'OTP must be exactly 6 characters' })
  otp!: string;

  @IsString({ message: 'New password must be a string' })
  @Length(8, 72, {
    message: 'New password must be between 8 and 72 characters',
  })
  newPassword!: string;
}
