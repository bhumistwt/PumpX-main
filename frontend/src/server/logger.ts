/**
 * PumpX — Production Logger (Pino)
 *
 * Structured JSON logging in production, pretty-printed in development.
 * All server-side code should import this instead of using console.log.
 */

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {
        // Production: structured JSON
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {
        // Development: pretty-printed
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),
});

export type Logger = typeof logger;

/** Create a child logger with a component/module context */
export function createLogger(module: string) {
  return logger.child({ module });
}

export default logger;
