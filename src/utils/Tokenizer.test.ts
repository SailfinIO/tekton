// src/utils/__tests__/Tokenizer.test.ts

import { Tokenizer } from './Tokenizer';

describe('Tokenizer', () => {
  describe('Line Ending Normalization', () => {
    test('should convert CRLF to LF', () => {
      const input = 'line1\r\nline2\r\nline3';
      const result = Tokenizer.tokenize(input);
      expect(result.length).toBe(3);
      expect(result[0].original).toBe('line1');
      expect(result[1].original).toBe('line2');
      expect(result[2].original).toBe('line3');
    });

    test('should convert CR to LF', () => {
      const input = 'line1\rline2\rline3';
      const result = Tokenizer.tokenize(input);
      expect(result.length).toBe(3);
      expect(result[0].original).toBe('line1');
      expect(result[1].original).toBe('line2');
      expect(result[2].original).toBe('line3');
    });

    test('should handle mixed line endings', () => {
      const input = 'line1\r\nline2\rline3\nline4';
      const result = Tokenizer.tokenize(input);
      expect(result.length).toBe(4);
      expect(result[0].original).toBe('line1');
      expect(result[1].original).toBe('line2');
      expect(result[2].original).toBe('line3');
      expect(result[3].original).toBe('line4');
    });

    test('should leave LF line endings unchanged', () => {
      const input = 'line1\nline2\nline3';
      const result = Tokenizer.tokenize(input);
      expect(result.length).toBe(3);
      expect(result[0].original).toBe('line1');
      expect(result[1].original).toBe('line2');
      expect(result[2].original).toBe('line3');
    });
  });

  describe('Blank Lines', () => {
    test('should identify completely empty lines as blank', () => {
      const input = 'line1\n\nline3';
      const result = Tokenizer.tokenize(input);
      expect(result[1].isBlank).toBe(true);
      expect(result[1].isComment).toBe(false);
    });

    test('should identify lines with only whitespace as blank', () => {
      const input = 'line1\n   \nline3';
      const result = Tokenizer.tokenize(input);
      expect(result[1].isBlank).toBe(true);
      expect(result[1].isComment).toBe(false);
    });
  });

  describe('Comment Lines', () => {
    test('should identify lines starting with # as comments', () => {
      const input = 'line1\n# This is a comment\nline3';
      const result = Tokenizer.tokenize(input);
      expect(result[1].isComment).toBe(true);
      expect(result[1].content).toBe('# This is a comment');
    });

    test('should identify lines with leading whitespace followed by # as comments', () => {
      const input = 'line1\n   # Indented comment\nline3';
      const result = Tokenizer.tokenize(input);
      expect(result[1].isComment).toBe(true);
      expect(result[1].content).toBe('# Indented comment');
      expect(result[1].indent).toBe(3);
    });
  });

  describe('YAML Directives', () => {
    test('should identify lines starting with % as directives', () => {
      const input = '%YAML 1.2\nkey: value';
      const result = Tokenizer.tokenize(input);
      expect(result[0].isDirective).toBe(true);
      expect(result[0].content).toBe('%YAML 1.2');
    });

    test('should not misidentify % in the middle of a line as a directive', () => {
      const input = 'key: value % not a directive';
      const result = Tokenizer.tokenize(input);
      expect(result[0].isDirective).toBe(false);
      expect(result[0].content).toBe('key: value % not a directive');
    });
  });

  describe('Document Markers', () => {
    test('should identify lines with --- as document markers', () => {
      const input = '---\nkey: value';
      const result = Tokenizer.tokenize(input);
      expect(result[0].isDocumentMarker).toBe(true);
      expect(result[0].content).toBe('---');
    });

    test('should identify lines with ... as document markers', () => {
      const input = '...\nkey: value';
      const result = Tokenizer.tokenize(input);
      expect(result[0].isDocumentMarker).toBe(true);
      expect(result[0].content).toBe('...');
    });

    test('should recognize document markers with leading/trailing whitespace', () => {
      const input = '  ---  \nkey: value';
      const result = Tokenizer.tokenize(input);
      expect(result[0].isDocumentMarker).toBe(true);
      expect(result[0].content).toBe('---');
      expect(result[0].indent).toBe(2);
    });
  });

  describe('Regular Lines Without Comments', () => {
    test('should correctly tokenize regular lines without comments', () => {
      const input = 'key: value\nanother_key: another_value';
      const result = Tokenizer.tokenize(input);
      expect(result.length).toBe(2);
      expect(result[0].isComment).toBe(false);
      expect(result[0].isBlank).toBe(false);
      expect(result[0].content).toBe('key: value');
      expect(result[1].content).toBe('another_key: another_value');
    });
  });

  describe('Regular Lines With Inline Comments', () => {
    test('should remove inline comments from lines with # outside quotes', () => {
      const input = 'key: value # This is a comment';
      const result = Tokenizer.tokenize(input);
      expect(result[0].content).toBe('key: value');
      expect(result[0].isComment).toBe(false);
    });

    test('should handle lines ending with #', () => {
      const input = 'key: value #';
      const result = Tokenizer.tokenize(input);
      expect(result[0].content).toBe('key: value');
    });
  });

  describe('Handling # Within Quotes', () => {
    test('should preserve # within single quotes', () => {
      const input = "key: 'value # not a comment' # comment";
      const result = Tokenizer.tokenize(input);
      expect(result[0].content).toBe("key: 'value # not a comment'");
    });

    test('should preserve # within double quotes', () => {
      const input = 'key: "value # not a comment" # comment';
      const result = Tokenizer.tokenize(input);
      expect(result[0].content).toBe('key: "value # not a comment"');
    });

    test('should handle escaped quotes correctly', () => {
      const input = 'key: "value \\"# not a comment\\"" # comment';
      const result = Tokenizer.tokenize(input);
      expect(result[0].content).toBe('key: "value \\"# not a comment\\""');
    });

    test('should handle multiple quotes and # characters', () => {
      const input = 'key: "value #1" and \'value #2\' # comment';
      const result = Tokenizer.tokenize(input);
      expect(result[0].content).toBe('key: "value #1" and \'value #2\'');
    });
  });

  describe('Indentation Handling', () => {
    test('should correctly calculate indentation with leading spaces', () => {
      const input = '  key: value';
      const result = Tokenizer.tokenize(input);
      expect(result[0].indent).toBe(2);
    });

    test('should set indent to 0 for lines without leading spaces', () => {
      const input = 'key: value';
      const result = Tokenizer.tokenize(input);
      expect(result[0].indent).toBe(0);
    });

    test('should handle lines with mixed spaces and tabs', () => {
      const input = '\t  key: value';
      const result = Tokenizer.tokenize(input);
      // Adjusted expectation: 1 tab (2 spaces) + 2 spaces = 4
      expect(result[0].indent).toBe(4);
    });
  });

  describe('Edge Cases', () => {
    test('should handle an entirely empty YAML string', () => {
      const input = '';
      const result = Tokenizer.tokenize(input);
      expect(result).toEqual([
        {
          original: '',
          content: '',
          indent: 0,
          isBlank: true,
          isComment: false,
          isDirective: false,
          isDocumentMarker: false,
          lineNumber: 1,
        },
      ]);
    });

    test('should handle YAML strings with only comments', () => {
      const input = '# Comment 1\n# Comment 2';
      const result = Tokenizer.tokenize(input);
      expect(result.length).toBe(2);
      result.forEach((line) => {
        expect(line.isComment).toBe(true);
        expect(line.content.startsWith('#')).toBe(true);
      });
    });

    test('should handle YAML strings with only directives', () => {
      const input = '%YAML 1.2\n%TAG !yaml! tag:yaml.org,2002:';
      const result = Tokenizer.tokenize(input);
      expect(result.length).toBe(2);
      result.forEach((line) => {
        expect(line.isDirective).toBe(true);
      });
    });

    test('should handle lines with only whitespace characters', () => {
      const input = '   \n\t\n  ';
      const result = Tokenizer.tokenize(input);
      expect(result.length).toBe(3);
      result.forEach((line) => {
        expect(line.isBlank).toBe(true);
      });
    });

    test('should handle lines with only quotes but no # characters', () => {
      const input = `"just a quoted string"\n'another quoted string'`;
      const result = Tokenizer.tokenize(input);
      expect(result.length).toBe(2);
      expect(result[0].content).toBe('"just a quoted string"');
      expect(result[1].content).toBe("'another quoted string'");
    });

    test('should treat lines with only a # character as comments', () => {
      const input = '#';
      const result = Tokenizer.tokenize(input);
      expect(result.length).toBe(1);
      expect(result[0].isComment).toBe(true);
      expect(result[0].content).toBe('#');
    });

    test('should handle lines where # appears immediately after a quote without space', () => {
      const input = `'value'#comment`;
      const result = Tokenizer.tokenize(input);
      expect(result[0].content).toBe("'value'");
    });
  });

  describe('Mixed Scenarios', () => {
    test('should correctly tokenize a complex YAML string with mixed features', () => {
      const input = `%YAML 1.2\r\n---
          key1: value1 # inline comment
            key2: "value #2"
          # A full line comment
          key3: 'value #3'\r\n...`;
      const result = Tokenizer.tokenize(input);
      expect(result.length).toBe(7);

      // Line 1: Directive
      expect(result[0].isDirective).toBe(true);
      expect(result[0].content).toBe('%YAML 1.2');

      // Line 2: Document Marker
      expect(result[1].isDocumentMarker).toBe(true);
      expect(result[1].content).toBe('---');

      // Line 3: Regular line with inline comment
      expect(result[2].isComment).toBe(false);
      expect(result[2].content).toBe('key1: value1');

      // Line 4: Regular line with quoted #
      expect(result[3].content).toBe('key2: "value #2"');

      // Line 5: Full line comment
      expect(result[4].isComment).toBe(true);
      expect(result[4].content).toBe('# A full line comment');

      // Line 6: Regular line with quoted #
      expect(result[5].content).toBe("key3: 'value #3'");

      // Line 7: Document Marker
      expect(result[6].isDocumentMarker).toBe(true);
      expect(result[6].content).toBe('...');
    });
  });

  describe('Error Handling', () => {
    test('should handle null input gracefully', () => {
      // Assuming the method expects a string, passing null should throw an error
      // Adjust based on actual implementation
      expect(() => Tokenizer.tokenize(null as unknown as string)).toThrow();
    });

    test('should handle undefined input gracefully', () => {
      // Assuming the method expects a string, passing undefined should throw an error
      // Adjust based on actual implementation
      expect(() =>
        Tokenizer.tokenize(undefined as unknown as string),
      ).toThrow();
    });

    test('should handle non-string inputs by throwing an error', () => {
      // Passing a number instead of a string
      expect(() => Tokenizer.tokenize(123 as unknown as string)).toThrow();
    });

    test('should handle lines with invalid characters', () => {
      const input = 'key: value\u0000';
      const result = Tokenizer.tokenize(input);
      expect(result.length).toBe(1);
      expect(result[0].content).toBe('key: value\u0000');
    });
  });
});
