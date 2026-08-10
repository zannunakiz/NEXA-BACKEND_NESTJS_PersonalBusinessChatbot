import arcjet, {
  ArcjetDecision,
  detectBot,
  fixedWindow,
  shield,
} from '@arcjet/node';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

type ArcjetMode = 'LIVE' | 'DRY_RUN';

function parseArcjetMode(mode?: string): ArcjetMode {
  return mode === 'LIVE' ? 'LIVE' : 'DRY_RUN';
}

@Injectable()
export class ArcjetService implements OnModuleInit {
  private readonly logger = new Logger(ArcjetService.name);
  private aj!: ReturnType<typeof arcjet>;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const key = this.configService.get<string>('ARCJET_KEY', '');
    const mode = parseArcjetMode(this.configService.get<string>('ARCJET_MODE'));

    if (!key) {
      this.logger.warn(
        'ARCJET_KEY is not defined. Arcjet protection will be bypassed.',
      );
      return;
    }

    this.aj = arcjet({
      key,
      characteristics: ['ip.src'],
      rules: [
        shield({
          mode,
        }),
        detectBot({
          mode,
          allow: ['CATEGORY:SEARCH_ENGINE'],
        }),
        fixedWindow({
          mode,
          window: '30s',
          max: 50,
        }),
      ],
    });

    this.logger.log(
      `🛡️ Arcjet initialized in ${mode} mode with rate limit max: 5/30s.`,
    );
  }

  async protect(req: Request): Promise<ArcjetDecision | null> {
    if (!this.aj) {
      return null;
    }

    return this.aj.protect(req);
  }
}
