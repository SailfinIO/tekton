// src/utils/__mocks__/Logger.ts

import { LogLevel } from '../../enums';
import { ILogger } from '../../interfaces/ILogger';

// Create mock functions for logger methods
export const mockedError = jest.fn();
export const mockedWarn = jest.fn();
export const mockedInfo = jest.fn();
export const mockedDebug = jest.fn();
export const mockedVerbose = jest.fn();
export const mockedSetLogLevel = jest.fn();

// Mocked Logger class with flexible constructor
export class Logger implements ILogger {
  error = mockedError;
  warn = mockedWarn;
  info = mockedInfo;
  debug = mockedDebug;
  verbose = mockedVerbose;
  setLogLevel = mockedSetLogLevel;

  constructor(...args: any[]) {
    // Accept any number of arguments to prevent constructor mismatch
  }
}
