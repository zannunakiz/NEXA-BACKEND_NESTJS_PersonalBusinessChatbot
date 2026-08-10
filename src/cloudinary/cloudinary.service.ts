import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import 'multer';
import streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder = 'NEXA_nestjs',
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder },
        (error, result) => {
          if (error) {
            let rejectionError: Error;
            if (error instanceof Error) {
              rejectionError = error;
            } else if (typeof error === 'string') {
              rejectionError = new Error(error);
            } else {
              rejectionError = new Error(JSON.stringify(error));
            }
            return reject(rejectionError);
          }
          if (!result) {
            return reject(new Error('Cloudinary upload result is undefined'));
          }
          resolve(result);
        },
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async deleteImage(imageUrlOrPublicId: string): Promise<void> {
    const publicId =
      this.extractPublicId(imageUrlOrPublicId) ?? imageUrlOrPublicId;

    if (!publicId) {
      return;
    }

    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      this.logger.error(
        `Failed to delete image from Cloudinary (Public ID: ${publicId}):`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  public extractPublicId(url: string): string | null {
    try {
      if (!url || !url.includes('cloudinary.com')) {
        return null;
      }

      const parts = url.split('/upload/');
      if (parts.length < 2) {
        return null;
      }

      let path = parts[1];
      path = path.replace(/^v\d+\//, '');

      const lastDotIndex = path.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        path = path.substring(0, lastDotIndex);
      }

      return path;
    } catch {
      return null;
    }
  }
}
