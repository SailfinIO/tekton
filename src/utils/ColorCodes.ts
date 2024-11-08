import { LabelSelector } from '../types';
import { LogLevel } from '../enums';

/**
 * ANSI color codes for log levels, used to style console log output.
 * Each log level is associated with a specific color for improved readability.
 */
export const ColorCodes: LabelSelector = {
  /**
   * Red color code for error messages, indicating critical issues.
   */
  [LogLevel.ERROR]: '\x1b[31m', // Red

  /**
   * Yellow color code for warning messages, indicating potential issues.
   */
  [LogLevel.WARN]: '\x1b[33m', // Yellow

  /**
   * Green color code for informational messages, indicating standard operational messages.
   */
  [LogLevel.INFO]: '\x1b[32m', // Green

  /**
   * Cyan color code for debug messages, used for troubleshooting and detailed insights.
   */
  [LogLevel.DEBUG]: '\x1b[36m', // Cyan

  /**
   * Magenta color code for verbose messages, offering the most detailed level of logging.
   */
  [LogLevel.VERBOSE]: '\x1b[35m', // Magenta

  /**
   * White color code for non-log-level-specific elements, such as timestamps.
   */
  white: '\x1b[37m', // White

  /**
   * Yellow color code for context or general highlighting, reused from WARN level.
   */
  yellow: '\x1b[33m', // Yellow
};

/**
 * ANSI reset code to clear formatting and return to the default console color.
 * Used after each colored message to prevent color bleed.
 */
export const ResetCode = '\x1b[0m';
