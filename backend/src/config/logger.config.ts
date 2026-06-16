import { format, transports } from 'winston';
import { WinstonModuleOptions } from 'nest-winston';

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

export const loggerConfig: WinstonModuleOptions = {
  transports: [
    new transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? format.combine(maskPii(), format.timestamp(), format.json())
          : format.combine(
              maskPii(),
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
