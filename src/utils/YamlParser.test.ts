// tests/YamlParser.test.ts

import { YamlParser } from './YamlParser';
import { ParsingError, SerializationError } from '../errors';
import { Logger } from './Logger';
import {
  IYamlParser,
  MultiLineState,
  StackElement,
  YAMLMap,
  YAMLSequence,
} from '../interfaces';
import { NodeType, ScalarStyle } from '../enums';
import { YAMLValue } from '../types';

// Mock the Logger
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

jest.mock('./Logger', () => ({
  Logger: jest.fn().mockImplementation(() => mockLogger),
}));

let yamlParser: IYamlParser & Partial<YamlParser>;

beforeEach(() => {
  (Logger as jest.Mock).mockClear();
  Object.values(mockLogger).forEach((mockFn) => mockFn.mockClear());
  yamlParser = new YamlParser();
});

describe('YamlParser', () => {
  describe('Initialization', () => {
    it('should initialize with default stack, multiLineState, and indentSize', () => {
      expect(yamlParser.stack).toHaveLength(1);
      expect(yamlParser.stack[0]).toEqual({
        indent: -1,
        obj: {} as YAMLMap,
        type: NodeType.Map,
      });
      expect(yamlParser.multiLineState).toBeNull();
      expect(yamlParser.indentSize).toBe(2);
    });
  });

  describe('Getters and Setters', () => {
    it('should allow updating the stack using setter', () => {
      const newStack: StackElement[] = [
        { indent: 0, obj: [] as YAMLSequence, type: NodeType.Sequence },
      ];
      yamlParser.stack = newStack;
      expect(yamlParser.stack).toEqual(newStack);
    });

    it('should allow updating the multiLineState using setter', () => {
      const newState: MultiLineState = {
        key: 'description',
        type: ScalarStyle.Literal,
        baseIndent: 2,
        lines: ['Line1', 'Line2'],
      };
      yamlParser.multiLineState = newState;
      expect(yamlParser.multiLineState).toEqual(newState);
    });
  });

  describe('parse', () => {
    it('should throw ParsingError for non-string input', () => {
      expect(() => yamlParser.parse(null as any)).toThrow(ParsingError);
      expect(() => yamlParser.parse(123 as any)).toThrow(ParsingError);
    });

    it('should throw ParsingError for empty string input', () => {
      expect(() => yamlParser.parse('')).toThrow(ParsingError);
    });

    it('should parse a simple YAML string', () => {
      const yaml = 'key: value';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({ key: 'value' });
    });

    it('should parse a YAML string with sequences', () => {
      const yaml = 'list:\n  - item1\n  - item2';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({ list: ['item1', 'item2'] });
    });

    it('should parse a YAML string with nested mappings', () => {
      const yaml = 'parent:\n  child: value';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({ parent: { child: 'value' } });
    });

    it('should handle YAML directives', () => {
      const yaml = '%YAML 1.2\n---\nkey: value';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({ key: 'value' });
      expect(mockLogger.info).toHaveBeenCalledWith('YAML Directive found: 1.2');
    });

    it('should log a warning for unsupported directive', () => {
      const yaml = '%UNKNOWN directive';
      yamlParser.parse(yaml);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unsupported directive'),
      );
    });

    it('should handle multi-line strings', () => {
      const yaml = 'key: |\n  line1\n  line2';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({ key: 'line1\nline2' });
    });

    it('should handle complex YAML structures with mixed types', () => {
      const yaml = 'mixed:\n  - key: value\n  - list:\n      - item1';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({
        mixed: [{ key: 'value' }, { list: ['item1'] }],
      });
    });
  });

  describe('stringify', () => {
    it('should stringify a simple object', () => {
      const data = { key: 'value' };
      const result = yamlParser.stringify(data);
      expect(result).toBe('key: value');
    });

    it('should stringify an object with sequences', () => {
      const data = { list: ['item1', 'item2'] };
      const result = yamlParser.stringify(data);
      expect(result).toBe('list:\n  - item1\n  - item2');
    });

    it('should stringify a nested object', () => {
      const data = { parent: { child: 'value' } };
      const result = yamlParser.stringify(data);
      expect(result).toBe('parent:\n  child: value');
    });

    it('should handle special characters in keys and values', () => {
      const data = { 'key:with:special:chars': 'value with spaces' };
      const result = yamlParser.stringify(data);
      expect(result).toBe('"key:with:special:chars": "value with spaces"');
    });

    it('should handle empty arrays and objects', () => {
      const data = { emptyArray: [], emptyObject: {} };
      const result = yamlParser.stringify(data);
      expect(result).toBe('emptyArray: []\nemptyObject: {}');
    });

    it('should throw SerializationError on unsupported data type', () => {
      const unsupportedData = (() => {}) as unknown as YAMLValue;
      expect(() => yamlParser.stringify(unsupportedData)).toThrow(
        SerializationError,
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw ParsingError for invalid mappings', () => {
      const yaml = 'invalid mapping';
      expect(() => yamlParser.parse(yaml)).toThrow(ParsingError);
    });

    it('should throw SerializationError on invalid data types in stringify', () => {
      const unsupportedData = Symbol('unsupported') as unknown as YAMLValue;
      expect(() => yamlParser.stringify(unsupportedData)).toThrow(
        SerializationError,
      );
    });

    it('should log error and rethrow SerializationError', () => {
      const unsupportedData = Symbol('unsupported') as unknown as YAMLValue;
      expect(() => yamlParser.stringify(unsupportedData)).toThrow(
        SerializationError,
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Complex Structures', () => {
    it('should handle deeply nested objects in stringify', () => {
      const data = { a: { b: { c: { d: 'value' } } } };
      const result = yamlParser.stringify(data);
      expect(result).toContain('a:\n  b:\n    c:\n      d: value');
    });

    it('should handle nested arrays in stringify', () => {
      const data = { list: [[{ item: 'value' }]] };
      const result = yamlParser.stringify(data);
      expect(result).toContain('- - item: value');
    });

    it('should handle arrays with mixed types', () => {
      const data = { mixed: [1, 'string', { key: 'value' }, [1, 2]] };
      const result = yamlParser.stringify(data);
      expect(result).toContain(
        'mixed:\n  - 1\n  - string\n  - key: value\n  - - 1\n    - 2',
      );
    });
  });
});
