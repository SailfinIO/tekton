/**
 * YamlParser.ts
 * This file contains a class that parses YAML strings into JavaScript objects.
 * The parse method reads a YAML string and returns a JavaScript object.
 */

import { ParsingError } from '../errors';
import { Logger } from './Logger';

/**
 * YamlParser
 * A class that parses
 * YAML strings into JavaScript objects.
 * The parse method reads a YAML string and returns a JavaScript object.
 */
export class YamlParser {
  private static readonly logger = new Logger(YamlParser.name);

  /**
   * Parse a YAML string into a JavaScript object.
   * @param yamlString The YAML string to parse.
   * @returns The JavaScript object parsed from the YAML string.
   * @throws {ParsingError} If the YAML string is invalid.
   * @throws {Error} If the YAML string is empty or not a string.
   * @throws {Error} If an error occurs while parsing the YAML string.
   * @example
   * ```typescript
   * const yamlString = `
   * key1: value1
   * key2: value2
   * `;
   * const result = YamlParser.parse(yamlString);
   * console.log(result);
   */
  public static parse(yamlString: string): any {
    try {
      if (!yamlString || typeof yamlString !== 'string') {
        YamlParser.logger.error(
          'Invalid input: YAML string must be a non-empty string.',
        );
        throw new ParsingError(
          'Invalid input: YAML string must be a non-empty string.',
          yamlString,
        );
      }

      const lines = yamlString.split('\n');
      const result: any = {};
      const stack: { indent: number; obj: any }[] = [
        { indent: -1, obj: result },
      ];

      // Parse each line of the YAML string
      lines.forEach((line, index) => {
        try {
          if (line.trim() === '' || line.trim().startsWith('#')) {
            return;
          }

          const indent = line.search(/\S/);
          const trimmedLine = line.trim();

          if (!trimmedLine.includes(':')) {
            throw new Error(`Invalid line format: ${trimmedLine}`);
          }

          const [key, ...rest] = trimmedLine.split(':');
          const valuePart = rest.join(':').trim();

          if (!key) {
            throw new Error(`Missing key in line: ${trimmedLine}`);
          }

          // Remove objects from the stack if current indent is less or equal
          while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
            stack.pop();
          }

          // Get the parent object from the stack
          const parentObj = stack[stack.length - 1].obj;

          let value: any;
          if (valuePart) {
            value = valuePart;
          } else {
            value = {};
          }

          parentObj[key] = value;

          if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
          ) {
            // Push the current object onto the stack
            stack.push({ indent, obj: value });
          }
        } catch (lineError) {
          this.logger.error(
            `Error parsing line ${index + 1}: ${line}`,
            lineError,
          );
        }
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to parse YAML string.', error);
      throw error;
    }
  }
}
