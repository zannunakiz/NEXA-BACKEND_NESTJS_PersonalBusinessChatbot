import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiErrorResponse,
  ValidationErrorDetail,
} from '../interfaces/api-response.interface';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  private readonly notFoundMessage =
    'Whoa, looks like that path does not exist in my world. 🕵️‍♂️ Head back to /api to see what I can do. 👋';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers['x-request-id'] as string) ||
      `req_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let errors: ValidationErrorDetail[] | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resObj = exception.getResponse();

      if (typeof resObj === 'string') {
        message = resObj;
      } else if (typeof resObj === 'object' && resObj !== null) {
        const payload = resObj as Record<string, unknown>;
        message = (payload.message as string) || exception.message;
        errorCode =
          (payload.error as string)?.toUpperCase().replace(/\s+/g, '_') ||
          'BAD_REQUEST';

        if (Array.isArray(payload.message)) {
          errorCode = 'VALIDATION_ERROR';
          message = 'Validation failed';
          errors = payload.message.map((msg: string) => {
            const parts = msg.split(' ');
            return {
              field: parts[0] || 'unknown',
              message: msg,
            };
          });
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    }

    if (
      status === HttpStatus.NOT_FOUND &&
      typeof message === 'string' &&
      message.startsWith('Cannot ')
    ) {
      message = this.notFoundMessage;
      errorCode = 'NOT_FOUND';
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      statusCode: status,
      errorCode,
      message,
      ...(errors ? { errors } : {}),
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId,
      },
    };

    response.status(status).json(errorResponse);
  }
}
