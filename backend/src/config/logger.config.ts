import { format, transports } from 'winston';
import { WinstonModuleOptions } from 'nest-winston';
import { ConfigService } from '@nestjs/config';
import { Env } from './env.config';
import { getCorrelationId } from '../common/correlation/correlation-id.store';

const maskPii = format((info) => {
  const maskFields = /password|token|secret|credit_card|email|ip|ipaddress/i;
  const maskValue = '[REDACTED]';

  const maskObject = (obj: any) => {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        maskObject(obj[key]);
      } else if (maskFields.test(key)) {
        obj[key] = maskValue;
      }
    }
  };

  maskObject(info);
  return info;
});

const addCorrelationId = format((info) => {
  const correlationId = getCorrelationId();
  if (correlationId) {
    info.correlationId = correlationId;
  }
  return info;
});

export function createLoggerConfig(configService: ConfigService<Env>): WinstonModuleOptions {
  const isProduction = configService.get('NODE_ENV', 'development') === 'production';

  return {
    transports: [
      new transports.Console({
        format: isProduction
          ? format.combine(maskPii(), addCorrelationId(), format.timestamp(), format.json())
          : format.combine(
              maskPii(),
              addCorrelationId(),
              format.timestamp(),
              format.colorize(),
              format.printf(({ timestamp, level, message, context, ...meta }) => {
                const contextStr = context ? ` [${context}]` : '';
                const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                return `${timestamp} [${level}]${contextStr}: ${message}${metaStr}`;
              }),
            ),
      }),
    ],
  };
}
