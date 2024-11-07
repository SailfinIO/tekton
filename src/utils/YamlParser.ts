// src/utils/YamlParser.ts

import { Logger } from './Logger';

export class YamlParser {
  private readonly logger = new Logger(YamlParser.name);

  public static parse(yamlString: string): any {
    const lines = yamlString.split('\n');
    const result: any = {};
    let currentIndent = 0;
    let currentObj = result;
    const parents: any[] = [];

    lines.forEach((line) => {
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
    });

    return result;
  }
}
