import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OpenRouterPingResult {
  status: 'up' | 'down';
  message?: string;
}

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);

  constructor(private readonly configService: ConfigService) {}

  async ping(): Promise<OpenRouterPingResult> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');

    if (!apiKey) {
      return {
        status: 'down',
        message: 'OPENROUTER_API_KEY is missing in environment configuration',
      };
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        return {
          status: 'down',
          message: `OpenRouter API responded with HTTP status ${response.status}`,
        };
      }

      return {
        status: 'up',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`OpenRouter ping failure: ${errorMessage}`);
      return {
        status: 'down',
        message: errorMessage,
      };
    }
  }
}
