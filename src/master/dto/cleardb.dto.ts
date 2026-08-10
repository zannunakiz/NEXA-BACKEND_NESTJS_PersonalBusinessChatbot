import { IsNotEmpty, IsString } from 'class-validator';

export class ClearDbRequest {
  @IsString()
  @IsNotEmpty({ message: 'masterKey cannot be empty' })
  masterKey!: string;
}

export interface TableDetail {
  users: number;
  organizations: number;
  members: number;
  chatbots: number;
  characteristics: number;
  sessions: number;
  chats: number;
}

export interface ClearDbResponse {
  message: string;
  totalDeleted: number;
  primary: TableDetail;
  replica: TableDetail;
  backup: TableDetail;
  timestamp: Date;
}
