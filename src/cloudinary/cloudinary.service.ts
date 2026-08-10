import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
};

type CloudinaryDestroyResult = {
  result?: string;
};

export interface ExpressMulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  async uploadImage(file: ExpressMulterFile): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'instagus_posts' },
        (error, result: CloudinaryUploadResult | undefined) => {
          if (error) {
            return reject(
              new BadRequestException(
                `Cloudinary upload failed: ${this.getErrorMessage(error)}`,
              ),
            );
          }
          if (!result) {
            return reject(
              new BadRequestException(
                'Cloudinary upload returned empty response',
              ),
            );
          }
          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      void cloudinary.uploader.destroy(
        publicId,
        (error, result: CloudinaryDestroyResult | undefined) => {
          if (error) {
            return reject(
              new BadRequestException(
                `Cloudinary deletion failed: ${this.getErrorMessage(error)}`,
              ),
            );
          }

          const status = result?.result;
          if (status !== 'ok' && status !== 'not found') {
            return reject(
              new BadRequestException(
                `Failed to delete image from Cloudinary: ${status ?? 'unknown'}`,
              ),
            );
          }
          resolve();
        },
      );
    });
  }

  extractPublicIdFromUrl(url: string): string {
    const regex = /\/v\d+\/(.+)\.[a-zA-Z0-9]+$/;
    const match = url.match(regex);
    if (match && match[1]) {
      return match[1];
    }
    const fallbackRegex = /\/([^/]+)\.[a-zA-Z0-9]+$/;
    const fallbackMatch = url.match(fallbackRegex);
    if (fallbackMatch && fallbackMatch[1]) {
      return fallbackMatch[1];
    }
    throw new BadRequestException('Invalid Cloudinary URL structure');
  }
}
