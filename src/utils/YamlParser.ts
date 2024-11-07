// src/utils/YamlParser.ts

import { ParsingError } from '../errors';
import { Logger } from './Logger';

export class YamlParser {
  private static readonly logger = new Logger(YamlParser.name);

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
      let currentIndent = 0;
      let currentObj = result;
      const parents: any[] = [];

      lines.forEach((line, index) => {
        try {
          if (line.trim() === '' || line.trim().startsWith('#')) {
            return;
          }

          const indent = line.search(/\S/);
          const trimmedLine = line.trim();
          const [key, ...rest] = trimmedLine.split(':');
          const value = rest.join(':').trim();

          if (indent > currentIndent) {
            parents.push(currentObj);
            currentObj =
              currentObj[
                Object.keys(currentObj)[Object.keys(currentObj).length - 1]
              ];
            currentIndent = indent;
          } else if (indent < currentIndent) {
            while (currentIndent > indent) {
              currentObj = parents.pop();
              currentIndent -= 2;
            }
          }

          if (value) {
            currentObj[key] = value;
          } else {
            currentObj[key] = {};
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
      throw error; // Rethrow the error after logging
    }
  }
}
