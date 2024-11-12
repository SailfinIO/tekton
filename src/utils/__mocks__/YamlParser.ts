// src/utils/__mocks__/YamlParser.ts

import { IYamlParser } from '../../interfaces';

export const parseMock = jest.fn();
export const stringifyMock = jest.fn();

export class YamlParser implements IYamlParser {
  parse = parseMock;
  stringify = stringifyMock;

  constructor(...args: any[]) {
    // Accept any number of arguments
  }
}

export const mockedParse = parseMock;
export const mockedStringify = stringifyMock;
