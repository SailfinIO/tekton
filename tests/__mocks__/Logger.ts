// tests/__mocks__/Logger.ts

import { LogLevel } from '../../src/enums';

export class Logger {
  error = jest.fn((message: string, trace?: unknown) => {});
  warn = jest.fn((message: string, context?: unknown) => {});
  info = jest.fn((message: string, context?: unknown) => {});
  debug = jest.fn((message: string, context?: unknown) => {});
  verbose = jest.fn((message: string, context?: unknown) => {});
  setLogLevel = jest.fn((level: LogLevel) => {});

  constructor(
    context: string,
    logLevel: LogLevel = LogLevel.INFO,
    useColors: boolean = true,
  ) {}
}
