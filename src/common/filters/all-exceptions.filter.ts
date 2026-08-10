import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    let errorOutput: unknown;
    let logMessage: string;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      if ('message' in exceptionResponse) {
        const msgProp = exceptionResponse.message;
        if (Array.isArray(msgProp)) {
          errorOutput = msgProp.join(', ');
          logMessage = msgProp.join(', ');
        } else if (typeof msgProp === 'string') {
          errorOutput = msgProp;
          logMessage = msgProp;
        } else {
          errorOutput = msgProp;
          logMessage = JSON.stringify(msgProp);
        }
      } else {
        errorOutput = exceptionResponse;
        logMessage = JSON.stringify(exceptionResponse);
      }
    } else {
      errorOutput = exceptionResponse;
      logMessage = String(exceptionResponse);
    }

    response.locals.errorMessage = logMessage;

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: errorOutput,
    });
  }
}
