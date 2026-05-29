import { format, transports } from 'winston';
import { WinstonModuleOptions } from 'nest-winston';

export const loggerConfig: WinstonModuleOptions = {
  transports: [
    new transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? format.combine(format.timestamp(), format.json())
          : format.combine(
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
