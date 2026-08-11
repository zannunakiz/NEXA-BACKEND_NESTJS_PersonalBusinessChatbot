import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OpenRouterPingResult {
  status: 'up' | 'down';
  message?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const OPENROUTER_MODEL = 'openrouter/free';

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

  async generateChat(messages: ChatMessage[]): Promise<string> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');

    if (!apiKey) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }

    try {
      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer':
              this.configService.get<string>('APP_URL') ||
              'http://localhost:3000',
            'X-Title': 'NEXA AI',
          },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages,
            max_tokens: 500,
            temperature: 0.3,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenRouter responded with HTTP ${response.status}: ${errorText}`,
        );
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenRouter returned an empty response');
      }

      return content;
    } catch (error) {
      this.logger.error(
        'OpenRouter generation failure:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException(
        'AI service failed to generate a response. Please try again later',
      );
    }
  }
}
