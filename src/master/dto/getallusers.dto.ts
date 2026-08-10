import { IsNotEmpty, IsString } from 'class-validator';

export interface UserDto {
  id: string;
  email: string;
  username: string;
  image_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export class GetAllUsersRequest {
  @IsString()
  @IsNotEmpty({ message: 'masterKey cannot be empty' })
  masterKey!: string;
}

export interface GetAllUsersResponse {
  message: string;
  totalUsers: number;
  users: UserDto[];
  timestamp: Date;
}
