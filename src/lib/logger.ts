/**
 * Production-safe logging utility
 * 
 * In production: Logs are completely stripped (no console output)
 * In development: Full console output for debugging
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.log('Debug info', data);
 *   logger.error('Error occurred', error);
 *   logger.warn('Warning message');
 *   logger.info('Info message');
 */

const isProduction = import.meta.env.PROD;

// No-op function for production
const noop = () => {};

// Create type-safe logger interface
interface Logger {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  table: (data: unknown) => void;
  group: (label: string) => void;
  groupEnd: () => void;
  time: (label: string) => void;
  timeEnd: (label: string) => void;
}

/**
 * Production-safe logger
 * All methods are no-ops in production to prevent exposing internal details
 */
export const logger: Logger = isProduction
  ? {
      log: noop,
      error: noop,
      warn: noop,
      info: noop,
      debug: noop,
      table: noop,
      group: noop,
      groupEnd: noop,
      time: noop,
      timeEnd: noop,
    }
  : {
      log: (...args: unknown[]) => console.log(...args),
      error: (...args: unknown[]) => console.error(...args),
      warn: (...args: unknown[]) => console.warn(...args),
      info: (...args: unknown[]) => console.info(...args),
      debug: (...args: unknown[]) => console.debug(...args),
      table: (data: unknown) => console.table(data),
      group: (label: string) => console.group(label),
      groupEnd: () => console.groupEnd(),
      time: (label: string) => console.time(label),
      timeEnd: (label: string) => console.timeEnd(label),
    };

/**
 * User-friendly error handler for production
 * Returns a generic message for users while logging details server-side
 * 
 * Usage:
 *   try {
 *     await someOperation();
 *   } catch (error) {
 *     const userMessage = handleError(error, 'Failed to save data');
 *     toast.error(userMessage);
 *   }
 */
export const handleError = (
  error: unknown,
  fallbackMessage = 'Something went wrong. Please try again.'
): string => {
  // In development, log the full error for debugging
  if (!isProduction) {
    console.error('Error details:', error);
  }
  
  // Always return a user-friendly message
  return fallbackMessage;
};

/**
 * Check if we're in development mode
 */
export const isDevelopment = !isProduction;

/**
 * Conditional logging - only runs in development
 * Useful for wrapping expensive debug operations
 * 
 * Usage:
 *   devOnly(() => {
 *     console.log('Complex debug data:', computeExpensiveDebugInfo());
 *   });
 */
export const devOnly = (fn: () => void): void => {
  if (!isProduction) {
    fn();
  }
};
