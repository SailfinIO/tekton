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
        mixed: [{ key: 'value' }, { list: { list: ['item1'] } }],
      });
    });
    it('should handle sequences of sequences', () => {
      const yaml = 'matrix:\n  - - 1\n    - 2\n  - - 3\n    - 4';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({
        matrix: [
          [1, 2],
          [3, 4],
        ],
      });
    });

    it('should handle maps within maps within sequences', () => {
      const yaml =
        'data:\n  - info:\n      name: John\n      age: 30\n  - info:\n      name: Jane\n      age: 25';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({
        data: [
          { info: { name: 'John', age: 30 } },
          { info: { name: 'Jane', age: 25 } },
        ],
      });
    });
    it('should throw ParsingError for invalid indentation', () => {
      const yaml = 'parent:\n   child: value'; // Invalid indentation (3 spaces)
      expect(() => yamlParser.parse(yaml)).toThrow(ParsingError);
    });

    it('should handle multi-line folded scalars', () => {
      const yaml = 'description: >\n  This is a folded\n  multi-line string.';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({
        description: 'This is a folded multi-line string.',
      });
    });

    it('should handle multi-line literal scalars with empty lines', () => {
      const yaml = 'description: |\n  Line1\n  \n  Line3';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({ description: 'Line1\n\nLine3' });
    });

    it('should handle sequences with inline mappings', () => {
      const yaml =
        'items:\n  - name: Item1\n    value: 10\n  - name: Item2\n    value: 20';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({
        items: [
          { name: 'Item1', value: 10 },
          { name: 'Item2', value: 20 },
        ],
      });
    });

    it('should handle empty multi-line scalar', () => {
      const yaml = 'empty_scalar: |';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({ empty_scalar: '' });
    });

    it('should handle scalar values with special characters requiring quotes', () => {
      const yaml = 'complex_key: "value:with:special,characters"';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({ complex_key: 'value:with:special,characters' });
    });

    it('should handle sequence items that are null', () => {
      const yaml = 'list:\n  - item1\n  - null\n  - item3';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({ list: ['item1', null, 'item3'] });
    });

    it('should handle mappings with null and undefined values', () => {
      const yaml = 'key1: null\nkey2:';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({ key1: null, key2: {} });
    });

    it('should log info for each YAML directive encountered', () => {
      const yaml = '%YAML 1.1\n%TAG !yaml! tag:yaml.org,2002:\n---\nkey: value';
      yamlParser.parse(yaml);
      expect(mockLogger.info).toHaveBeenCalledWith('YAML Directive found: 1.1');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unsupported directive at line 2: %TAG !yaml! tag:yaml.org,2002:',
      );
      // Adjust expectations based on actual directive handling
    });

    it('should handle inline sequences and mappings correctly', () => {
      const yaml = 'inline_map: { key1: value1, key2: [item1, item2] }';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({
        inline_map: {
          key1: 'value1',
          key2: ['item1', 'item2'],
        },
      });
    });

    it('should handle comments and ignore them', () => {
      const yaml = '# This is a comment\nkey: value # Inline comment';
      const result = yamlParser.parse(yaml);
      expect(result).toEqual({ key: 'value' });
      // Ensure comments are not present in the result
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

    it('should handle special characters in keys and values requiring quotes', () => {
      const data = { 'key with spaces': 'value:with:special,characters' };
      const result = yamlParser.stringify(data);
      expect(result).toBe('"key with spaces": "value:with:special,characters"');
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
    it('should stringify multi-line literals correctly', () => {
      const data = { description: 'Line1\nLine2\nLine3' };
      const result = yamlParser.stringify(data);
      expect(result).toBe('description: |\n  Line1\n  Line2\n  Line3');
    });

    it('should handle nested multi-line strings', () => {
      const data = {
        parent: {
          child: 'This is a multi-line\nstring within a nested object.',
        },
      };
      const result = yamlParser.stringify(data);
      expect(result).toBe(
        'parent:\n  child: |\n    This is a multi-line\n    string within a nested object.',
      );
    });

    it('should handle arrays containing objects with multi-line strings', () => {
      const data = {
        list: [
          { description: 'First item\nwith multi-line' },
          { description: 'Second item\nwith multi-line' },
        ],
      };
      const result = yamlParser.stringify(data);
      expect(result).toBe(
        'list:\n  - description: |\n      First item\n      with multi-line\n  - description: |\n      Second item\n      with multi-line',
      );
    });

    it('should handle deeply nested structures in stringify', () => {
      const data = {
        a: {
          b: {
            c: {
              d: {
                e: {
                  f: 'deep value',
                },
              },
            },
          },
        },
      };
      const result = yamlParser.stringify(data);
      expect(result).toBe(
        'a:\n  b:\n    c:\n      d:\n        e:\n          f: "deep value"',
      );
    });

    it('should handle empty multi-line strings', () => {
      const data = { empty: '' };
      const result = yamlParser.stringify(data);
      expect(result).toBe('empty: ""');
    });

    it('should handle mixed data types in arrays', () => {
      const data = { mixed: [1, 'two', true, null, { key: 'value' }] };
      const result = yamlParser.stringify(data);
      expect(result).toBe(
        'mixed:\n  - 1\n  - two\n  - true\n  - null\n  - key: value',
      );
    });

    it('should handle keys that require quoting', () => {
      const data = { 'key with spaces': 'value' };
      const result = yamlParser.stringify(data);
      expect(result).toBe('"key with spaces": value');
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
    it('should log a warning for malformed YAML directives', () => {
      const yaml = '%YAML1.2\nkey: value'; // Missing space
      yamlParser.parse(yaml);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unsupported directive at line 1: %YAML1.2',
      );
    });

    it('should throw ParsingError for unbalanced braces in inline maps', () => {
      const yaml = 'inline_map: { key1: value1, key2: [item1, item2 }'; // Missing ]
      expect(() => yamlParser.parse(yaml)).toThrow(ParsingError);
    });

    it('should throw SerializationError when encountering circular references', () => {
      const data: any = {};
      data.self = data; // Circular reference
      expect(() => yamlParser.stringify(data)).toThrow(SerializationError);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle SerializationError gracefully and log the error', () => {
      // Force an error in stringifyData by passing an unsupported type
      const unsupportedData = Symbol('unsupported') as unknown as YAMLValue;
      expect(() => yamlParser.stringify(unsupportedData)).toThrow(
        SerializationError,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unsupported data type.',
        expect.any(SerializationError),
      );
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
