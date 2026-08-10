import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendEmailOptions {
  toEmail: string;
  toName?: string;
  subject?: string;
  message: string;
  templateParams?: Record<string, unknown>;
}

@Injectable()
export class EmailjsService {
  private readonly logger = new Logger(EmailjsService.name);

  constructor(private readonly configService: ConfigService) {}

  private get serviceId(): string {
    return this.configService.get<string>('EMAILJS_SERVICE_ID', '');
  }

  private get templateId(): string {
    return this.configService.get<string>('EMAILJS_TEMPLATE_ID', '');
  }

  private get publicKey(): string {
    return this.configService.get<string>('EMAILJS_PUBLIC_KEY', '');
  }

  private get privateKey(): string {
    return this.configService.get<string>('EMAILJS_PRIVATE_KEY', '');
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
      const response = await fetch(
        'https://api.emailjs.com/api/v1.0/email/send',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service_id: this.serviceId,
            template_id: this.templateId,
            user_id: this.publicKey,
            accessToken: this.privateKey,
            template_params: {
              to_email: options.toEmail,
              to_name: options.toName ?? options.toEmail,
              subject: options.subject ?? 'NEXA Notification',
              message: options.message,
              ...options.templateParams,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Failed to send email via EmailJS: ${errorText}`);
        return false;
      }

      this.logger.log(`Email successfully sent to ${options.toEmail}`);
      return true;
    } catch (error) {
      this.logger.error(
        'EmailJS sending failed:',
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  async ping(): Promise<{ status: 'up' | 'down'; message?: string }> {
    try {
      if (!this.serviceId || !this.publicKey || !this.privateKey) {
        return {
          status: 'down',
          message: 'EmailJS credentials missing in configuration',
        };
      }

      const response = await fetch(
        'https://api.emailjs.com/api/v1.0/email/send',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service_id: this.serviceId,
            template_id: 'ping_check_template',
            user_id: this.publicKey,
            accessToken: this.privateKey,
            template_params: {},
          }),
        },
      );

      const responseText = await response.text();

      if (response.ok) {
        return { status: 'up' };
      }

      if (
        response.status === 400 &&
        (responseText.includes('template_id') ||
          responseText.includes('Template') ||
          responseText.includes('template'))
      ) {
        return { status: 'up' };
      }

      return {
        status: 'down',
        message: `Unexpected status ${response.status}: ${responseText}`,
      };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
