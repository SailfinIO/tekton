// tests/YamlParser.test.ts

import { ParsingError } from '../../src/errors/ParsingError';
import { YamlParser } from '../../src/utils/YamlParser';

describe('YamlParser', () => {
  it('should parse a simple YAML string into an object', () => {
    const yamlString = `
    key1: value1
    key2: value2
    `;
    const expectedOutput = {
      key1: 'value1',
      key2: 'value2',
    };

    const result = YamlParser.parse(yamlString);
    expect(result).toEqual(expectedOutput);
  });

  it('should handle nested YAML correctly', () => {
    const yamlString = `
    parent1:
      child1: value1
      child2: value2
    `;
    const expectedOutput = {
      parent1: {
        child1: 'value1',
        child2: 'value2',
      },
    };

    const result = YamlParser.parse(yamlString);
    expect(result).toEqual(expectedOutput);
  });

  it('should handle empty strings', () => {
    expect(() => YamlParser.parse('')).toThrow(ParsingError);
  });

  it('should throw a ParsingError for invalid input types', () => {
    // @ts-expect-error Testing invalid input type
    expect(() => YamlParser.parse(123)).toThrow(ParsingError);
  });

  it('should ignore commented lines', () => {
    const yamlString = `
    # This is a comment
    key1: value1
    # Another comment
    key2: value2
    `;
    const expectedOutput = {
      key1: 'value1',
      key2: 'value2',
    };

    const result = YamlParser.parse(yamlString);
    expect(result).toEqual(expectedOutput);
  });

  it('should handle inconsistent indentation gracefully', () => {
    const yamlString = `
    key1:
      child1: value1
        child2: value2
    key2: value2
    `;
    const expectedOutput = {
      key1: {
        child1: 'value1',
        child2: 'value2',
      },
      key2: 'value2',
    };

    const result = YamlParser.parse(yamlString);
    expect(result).toEqual(expectedOutput);
  });

  it('should log an error if a line cannot be parsed', () => {
    const yamlString = `
    key1: value1
    invalid_line_without_colon
    key2: value2
    `;

    // Mock the logger to ensure it logs an error
    const loggerErrorSpy = jest.spyOn(YamlParser['logger'], 'error');

    YamlParser.parse(yamlString);

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error parsing line'),
      expect.any(Error),
    );
  });
});
