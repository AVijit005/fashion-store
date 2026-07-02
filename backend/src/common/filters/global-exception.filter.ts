import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { Prisma } from '@prisma/client';
import { getCorrelationId } from '../correlation/correlation-id.store';

export interface ErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string | string[];
  details?: Record<string, unknown>;
  requestId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();

      if (typeof errorResponse === 'string') {
        message = errorResponse;
      } else if (errorResponse && typeof errorResponse === 'object') {
        const errorObject = errorResponse as Record<string, unknown>;

        if (Array.isArray(errorObject.message)) {
          message = errorObject.message as string[];
          errorCode = 'VALIDATION_ERROR';
          details = errorObject;
        } else if (typeof errorObject.message === 'string') {
          message = errorObject.message;
        } else if (typeof errorObject.error === 'string') {
          message = errorObject.error;
        }
      }

      if (errorCode !== 'VALIDATION_ERROR') {
        errorCode = this.mapStatusToErrorCode(status);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Unique constraint failed';
        errorCode = 'CONFLICT';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        errorCode = 'NOT_FOUND';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = `Database error: ${exception.code}`;
        errorCode = 'DATABASE_ERROR';
      }
    }

    const requestId =
      getCorrelationId() ??
      (request.headers['x-request-id'] as string | undefined) ??
      (request.headers['x-correlation-id'] as string | undefined);

    const body: ErrorResponse = {
      success: false,
      statusCode: status,
      errorCode,
      message,
    };

    if (details) {
      body.details = details;
    }

    if (requestId) {
      body.requestId = requestId;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} - Error: ${
          exception instanceof Error ? exception.message : 'Unknown'
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
      Sentry.captureException(exception);
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} - Client Error: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json(body);
  }

  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
