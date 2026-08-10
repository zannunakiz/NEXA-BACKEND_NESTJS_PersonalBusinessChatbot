import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import 'multer';
import { JwtUser } from '../auth/jwt-auth.guard';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { DatabaseService } from '../database/database.service';

interface UserDbRow {
  id: string;
  email: string;
  username: string;
  image_url: string | null;
  created_at: Date;
}

@Injectable()
export class UserService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async updateUser(
    userId: string,
    username?: string,
    file?: Express.Multer.File,
  ): Promise<JwtUser> {
    const trimmedUsername = username?.trim();

    if (!trimmedUsername && !file) {
      throw new BadRequestException(
        'At least one field (username or image file) must be provided for update',
      );
    }

    const users = await this.databaseService.executeRead<UserDbRow>(
      'SELECT id, email, username, image_url, created_at FROM users WHERE id = $1 LIMIT 1',
      [userId],
    );

    if (users.length === 0) {
      throw new NotFoundException('User not found');
    }

    const currentUser = users[0];
    let finalUsername = currentUser.username;
    let finalImageUrl = currentUser.image_url;

    if (trimmedUsername && trimmedUsername !== currentUser.username) {
      const existingUsers = await this.databaseService.executeRead<UserDbRow>(
        'SELECT id FROM users WHERE username = $1 AND id != $2 LIMIT 1',
        [trimmedUsername, userId],
      );

      if (existingUsers.length > 0) {
        throw new ConflictException('Username is already taken');
      }

      finalUsername = trimmedUsername;
    }

    if (file) {
      if (currentUser.image_url) {
        await this.cloudinaryService.deleteImage(currentUser.image_url);
      }

      const uploadResult = await this.cloudinaryService.uploadImage(
        file,
        'NEXA_nestjs',
      );
      finalImageUrl = uploadResult.secure_url;
    }

    await this.databaseService.executeWrite(
      'UPDATE users SET username = $1, image_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [finalUsername, finalImageUrl, userId],
    );

    return {
      id: currentUser.id,
      email: currentUser.email,
      username: finalUsername,
      image_url: finalImageUrl,
      created_at: currentUser.created_at,
    };
  }
}
