/**
 * Logging Utility - Environment-aware logging with levels
 * 
 * Only outputs in development mode unless explicitly enabled.
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.debug('detailed info');
 *   logger.info('general info');
 *   logger.warn('warning');
 *   logger.error('error');
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
  prefix?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

// Default config - only log in development
const defaultConfig: LoggerConfig = {
  enabled: isDev,
  minLevel: isDev ? 'debug' : 'error',
  prefix: ''
};

class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private formatMessage(message: string): string {
    return this.config.prefix ? `${this.config.prefix} ${message}` : message;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(message), ...args);
    }
  }

  /**
   * Create a child logger with a prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix
    });
  }
}

// Default logger instance
export const logger = new Logger();

// Pre-configured loggers for different modules
export const calcLogger = new Logger({ prefix: '🧮 Calc' });
export const balanceLogger = new Logger({ prefix: '⚖️ Balance' });
export const dbLogger = new Logger({ prefix: '📦 DB' });
export const aiLogger = new Logger({ prefix: '🤖 AI' });
export const mlLogger = new Logger({ prefix: '🧠 ML' });

// Export Logger class for custom instances
export { Logger };
export type { LogLevel, LoggerConfig };
