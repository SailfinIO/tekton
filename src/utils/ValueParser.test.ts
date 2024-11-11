// src/utils/ValueParser.test.ts

import { ValueParser } from './ValueParser';

describe('ValueParser', () => {
  describe('parseInlineCollection', () => {
    /**
     * Scalars Tests
     */
    describe('Scalars', () => {
      describe('Numbers', () => {
        it('should correctly parse integer numbers', () => {
          expect(ValueParser.parseInlineCollection('42')).toBe(42);
          expect(ValueParser.parseInlineCollection('0xFF')).toBe(255);
          expect(ValueParser.parseInlineCollection('0755')).toBe(493);
          expect(ValueParser.parseInlineCollection('9007199254740991')).toBe(
            9007199254740991,
          ); // Number.MAX_SAFE_INTEGER
        });

        it('should correctly parse floating-point numbers', () => {
          expect(ValueParser.parseInlineCollection('3.14')).toBe(3.14);
          expect(ValueParser.parseInlineCollection('.inf')).toBe(Infinity);
          expect(ValueParser.parseInlineCollection('-.inf')).toBe(-Infinity);
          expect(isNaN(ValueParser.parseInlineCollection('.nan'))).toBe(true);
        });
      });

      describe('Booleans', () => {
        it('should correctly parse boolean values', () => {
          expect(ValueParser.parseInlineCollection('true')).toBe(true);
          expect(ValueParser.parseInlineCollection('false')).toBe(false);
        });

        it('should distinguish between boolean values and boolean-like strings', () => {
          expect(ValueParser.parseInlineCollection('"true"')).toBe('true');
          expect(ValueParser.parseInlineCollection('true')).toBe(true);
        });
      });

      describe('Null Values', () => {
        it('should correctly parse null values', () => {
          expect(ValueParser.parseInlineCollection('null')).toBeNull();
          expect(ValueParser.parseInlineCollection('~')).toBeNull();
        });
      });

      describe('Strings', () => {
        it('should correctly parse quoted strings', () => {
          expect(ValueParser.parseInlineCollection('"Hello, World"')).toBe(
            'Hello, World',
          );
          expect(ValueParser.parseInlineCollection("'Hello, World'")).toBe(
            'Hello, World',
          );
        });

        it('should correctly parse unquoted strings', () => {
          expect(ValueParser.parseInlineCollection('unquoted')).toBe(
            'unquoted',
          );
          expect(ValueParser.parseInlineCollection('')).toBe('');
        });

        it('should handle strings with escaped quotes correctly', () => {
          expect(
            ValueParser.parseInlineCollection('"Hello, \\"World\\""'),
          ).toBe('Hello, "World"');
          expect(ValueParser.parseInlineCollection("'It\\'s a test'")).toBe(
            "It's a test",
          );
        });

        it('should parse strings with Unicode characters correctly', () => {
          expect(ValueParser.parseInlineCollection('"こんにちは"')).toBe(
            'こんにちは',
          );
          expect(ValueParser.parseInlineCollection("'😊'")).toBe('😊');
        });
      });

      describe('Dates', () => {
        it('should parse ISO date strings correctly', () => {
          const dateStr = '"2024-04-27T10:20:30Z"';
          const expectedDate = new Date('2024-04-27T10:20:30Z');
          const parsedDate = ValueParser.parseInlineCollection(dateStr);
          expect(parsedDate instanceof Date).toBe(true);
          expect(parsedDate.toISOString()).toBe(expectedDate.toISOString());
        });
      });
    });

    /**
     * Arrays Tests
     */
    describe('Arrays', () => {
      it('should parse empty arrays', () => {
        expect(ValueParser.parseInlineCollection('[]')).toEqual([]);
      });

      it('should parse arrays with homogeneous scalar types', () => {
        expect(ValueParser.parseInlineCollection('[1, 2, 3]')).toEqual([
          1, 2, 3,
        ]);
        expect(ValueParser.parseInlineCollection('["a", "b", "c"]')).toEqual([
          'a',
          'b',
          'c',
        ]);
      });

      it('should parse arrays with mixed types', () => {
        expect(
          ValueParser.parseInlineCollection('[1, "two", true, null]'),
        ).toEqual([1, 'two', true, null]);
      });

      it('should parse nested arrays and objects within arrays', () => {
        expect(
          ValueParser.parseInlineCollection('[1, [2, 3], { "four": 4 }]'),
        ).toEqual([1, [2, 3], { four: 4 }]);
        expect(
          ValueParser.parseInlineCollection('[1, [2, [3, 4]], {"five": 5}]'),
        ).toEqual([1, [2, [3, 4]], { five: 5 }]);
      });

      it('should correctly parse deeply nested arrays with mixed data types', () => {
        const input =
          '[1, [2, ["three", { "four": 4 }, [5, "six"]]], true, null]';
        const expected = [
          1,
          [2, ['three', { four: 4 }, [5, 'six']]],
          true,
          null,
        ];
        expect(ValueParser.parseInlineCollection(input)).toEqual(expected);
      });

      it('should correctly parse arrays with empty nested arrays', () => {
        const input = '[[], [1, 2, []], [3, [4, []]] ]';
        const expected = [[], [1, 2, []], [3, [4, []]]];
        expect(ValueParser.parseInlineCollection(input)).toEqual(expected);
      });

      it('should correctly parse arrays containing objects with arrays as values', () => {
        const input =
          '[{ "key": [1, 2, 3] }, { "anotherKey": ["a", "b", "c"] }]';
        const expected = [{ key: [1, 2, 3] }, { anotherKey: ['a', 'b', 'c'] }];
        expect(ValueParser.parseInlineCollection(input)).toEqual(expected);
      });

      it('should parse arrays with strings containing commas', () => {
        expect(ValueParser.parseInlineCollection('["a, b", "c"]')).toEqual([
          'a, b',
          'c',
        ]);
      });

      it('should parse arrays with varied whitespace', () => {
        expect(ValueParser.parseInlineCollection('[ 1 ,  2 ,3 ]')).toEqual([
          1, 2, 3,
        ]);
      });

      it('should parse arrays with trailing commas', () => {
        expect(ValueParser.parseInlineCollection('[1, 2, 3,]')).toEqual([
          1, 2, 3,
        ]);
      });

      it('should throw error for arrays with mismatched brackets', () => {
        expect(() => ValueParser.parseInlineCollection('[1, 2, 3')).toThrow(
          'Mismatched brackets or braces in value: "[1, 2, 3"',
        );
      });

      it('should throw error for arrays with unclosed quotes', () => {
        expect(() => ValueParser.parseInlineCollection('[1, "Hello')).toThrow(
          'Unclosed quote in value: "[1, "Hello"',
        );
      });
    });

    /**
     * Objects Tests
     */
    describe('Objects', () => {
      it('should parse empty objects', () => {
        expect(ValueParser.parseInlineCollection('{}')).toEqual({});
      });

      it('should parse objects with scalar values', () => {
        expect(
          ValueParser.parseInlineCollection(
            '{key1: 1, key2: "two", key3: true}',
          ),
        ).toEqual({
          key1: 1,
          key2: 'two',
          key3: true,
        });
      });

      it('should parse objects with nested objects', () => {
        expect(
          ValueParser.parseInlineCollection('{outer: {inner: "value"}}'),
        ).toEqual({
          outer: { inner: 'value' },
        });
      });

      it('should parse objects with arrays as values', () => {
        expect(
          ValueParser.parseInlineCollection(
            '{numbers: [1, 2, 3], letters: ["a", "b"]}',
          ),
        ).toEqual({
          numbers: [1, 2, 3],
          letters: ['a', 'b'],
        });
      });

      it('should parse objects with mixed types', () => {
        expect(
          ValueParser.parseInlineCollection(
            '{num: 42, str: "hello", bool: false, nil: null}',
          ),
        ).toEqual({
          num: 42,
          str: 'hello',
          bool: false,
          nil: null,
        });
      });

      it('should parse objects with quoted keys and values', () => {
        expect(
          ValueParser.parseInlineCollection(
            '{"key one": "value one", \'key two\': \'value two\'}',
          ),
        ).toEqual({
          'key one': 'value one',
          'key two': 'value two',
        });
      });

      it('should parse objects with mixed quotes for keys and values', () => {
        const input = '{ "key1": \'value1\', \'key2\': "value2" }';
        const expected = { key1: 'value1', key2: 'value2' };
        expect(ValueParser.parseInlineCollection(input)).toEqual(expected);
      });

      it('should parse objects with duplicate keys by overriding with the last value', () => {
        const input = '{key: 1, key: 2}';
        const expected = { key: 2 };
        expect(ValueParser.parseInlineCollection(input)).toEqual(expected);
      });

      it('should parse objects with boolean and null as keys if supported', () => {
        const input = '{true: "yes", false: "no", null: "nothing"}';
        const expected = { true: 'yes', false: 'no', null: 'nothing' };
        expect(ValueParser.parseInlineCollection(input)).toEqual(expected);
      });

      it('should parse complex nested objects and arrays', () => {
        const input = '{a: [1, {b: [2, {c: "three"}]}, 3], d: {"e": "four"}}';
        const expected = {
          a: [1, { b: [2, { c: 'three' }] }, 3],
          d: { e: 'four' },
        };
        expect(ValueParser.parseInlineCollection(input)).toEqual(expected);
      });

      it('should throw error on invalid mappings', () => {
        expect(() => {
          ValueParser.parseInlineCollection('{key1 1, key2: 2}');
        }).toThrow('Invalid mapping: "key1 1"');
      });

      it('should throw error for objects with mismatched braces', () => {
        expect(() =>
          ValueParser.parseInlineCollection('{ "key": "value"'),
        ).toThrow('Mismatched brackets or braces in value: "{ "key": "value"');
      });

      it('should throw error for objects with unclosed quotes', () => {
        expect(() =>
          ValueParser.parseInlineCollection('{ "key": "Hello'),
        ).toThrow('Unclosed quote in value: "{ "key": "Hello"');
        expect(() =>
          ValueParser.parseInlineCollection("{ 'key': 'Hello"),
        ).toThrow("Unclosed quote in value: \"{ 'key': 'Hello\"");
      });
    });

    /**
     * Edge Cases and Error Handling Tests
     */
    describe('Edge Cases and Error Handling', () => {
      it('should handle leading and trailing whitespace', () => {
        expect(ValueParser.parseInlineCollection('  true  ')).toBe(true);
        expect(ValueParser.parseInlineCollection('  [1, 2, 3]  ')).toEqual([
          1, 2, 3,
        ]);
        expect(ValueParser.parseInlineCollection('  {a: 1}  ')).toEqual({
          a: 1,
        });
      });

      it('should handle strings containing braces and brackets inside quotes', () => {
        expect(
          ValueParser.parseInlineCollection('["{", "}", "[", "]"]'),
        ).toEqual(['{', '}', '[', ']']);
        expect(
          ValueParser.parseInlineCollection(
            '{key: "{value}", another: "[item]"}',
          ),
        ).toEqual({
          key: '{value}',
          another: '[item]',
        });
      });

      it('should handle empty input gracefully', () => {
        expect(ValueParser.parseInlineCollection('')).toBe('');
      });

      it('should throw error for completely invalid inputs', () => {
        expect(() => ValueParser.parseInlineCollection('!!!')).toThrow(
          'Unexpected token',
        );
        expect(() => ValueParser.parseInlineCollection('@invalid')).toThrow(
          'Unexpected token',
        );
      });
    });
  });
});
