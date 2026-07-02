import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter, ErrorResponse } from './global-exception.filter';
import { getCorrelationId } from '../correlation/correlation-id.store';
import * as Sentry from '@sentry/node';

jest.mock('../correlation/correlation-id.store', () => ({
  getCorrelationId: jest.fn(),
}));

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { method: string; url: string; headers: Record<string, string> };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      method: 'GET',
      url: '/api/test',
      headers: {},
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse as unknown as Response,
        getRequest: () => mockRequest as unknown as Request,
      }),
    } as ArgumentsHost;
    jest.clearAllMocks();
  });

  const getBody = (): ErrorResponse => mockResponse.json.mock.calls[0][0] as ErrorResponse;

  it('returns the stable error contract for a generic error', () => {
    (getCorrelationId as jest.Mock).mockReturnValue('req-123');

    filter.catch(new Error('boom'), mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(getBody()).toMatchObject({
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId: 'req-123',
    });
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('maps NotFoundException to NOT_FOUND with a string message', () => {
    filter.catch(new NotFoundException('Resource missing'), mockHost);

    expect(getBody()).toMatchObject({
      success: false,
      statusCode: HttpStatus.NOT_FOUND,
      errorCode: 'NOT_FOUND',
      message: 'Resource missing',
    });
    expect(typeof getBody().message).toBe('string');
  });

  it('maps UnauthorizedException to UNAUTHORIZED', () => {
    filter.catch(new UnauthorizedException('Login required'), mockHost);

    expect(getBody()).toMatchObject({
      success: false,
      statusCode: HttpStatus.UNAUTHORIZED,
      errorCode: 'UNAUTHORIZED',
      message: 'Login required',
    });
  });

  it('maps ForbiddenException to FORBIDDEN', () => {
    filter.catch(new ForbiddenException('No access'), mockHost);

    expect(getBody()).toMatchObject({
      success: false,
      statusCode: HttpStatus.FORBIDDEN,
      errorCode: 'FORBIDDEN',
      message: 'No access',
    });
  });

  it('maps ConflictException to CONFLICT', () => {
    filter.catch(new ConflictException('Already exists'), mockHost);

    expect(getBody()).toMatchObject({
      success: false,
      statusCode: HttpStatus.CONFLICT,
      errorCode: 'CONFLICT',
      message: 'Already exists',
    });
  });

  it('maps ValidationPipe-style errors to VALIDATION_ERROR with message array and details', () => {
    const exception = new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: ['email must be an email', 'password is too short'],
        error: 'Bad Request',
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost);

    const body = getBody();
    expect(body).toMatchObject({
      success: false,
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: 'VALIDATION_ERROR',
      message: ['email must be an email', 'password is too short'],
    });
    expect(Array.isArray(body.message)).toBe(true);
    expect(body.details).toEqual({
      statusCode: HttpStatus.BAD_REQUEST,
      message: ['email must be an email', 'password is too short'],
      error: 'Bad Request',
    });
  });

  it('maps Prisma P2002 unique constraint error to CONFLICT', () => {
    const exception = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: '6.0.0',
    });

    filter.catch(exception, mockHost);

    expect(getBody()).toMatchObject({
      success: false,
      statusCode: HttpStatus.CONFLICT,
      errorCode: 'CONFLICT',
      message: 'Unique constraint failed',
    });
  });

  it('maps Prisma P2025 record not found error to NOT_FOUND', () => {
    const exception = new Prisma.PrismaClientKnownRequestError('not found', {
      code: 'P2025',
      clientVersion: '6.0.0',
    });

    filter.catch(exception, mockHost);

    expect(getBody()).toMatchObject({
      success: false,
      statusCode: HttpStatus.NOT_FOUND,
      errorCode: 'NOT_FOUND',
      message: 'Record not found',
    });
  });

  it('maps other Prisma errors to DATABASE_ERROR', () => {
    const exception = new Prisma.PrismaClientKnownRequestError('other', {
      code: 'P9999',
      clientVersion: '6.0.0',
    });

    filter.catch(exception, mockHost);

    expect(getBody()).toMatchObject({
      success: false,
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: 'DATABASE_ERROR',
      message: 'Database error: P9999',
    });
  });

  it('falls back to x-request-id header when correlation id store is empty', () => {
    (getCorrelationId as jest.Mock).mockReturnValue(undefined);
    mockRequest.headers['x-request-id'] = 'header-req-id';

    filter.catch(new BadRequestException('Bad input'), mockHost);

    expect(getBody().requestId).toBe('header-req-id');
  });
});
