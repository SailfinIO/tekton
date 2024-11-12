// src/utils/Tokenizer.ts

import { TokenizedLine } from '../interfaces';

export class Tokenizer {
  /**
   * Splits the YAML string into tokenized lines, normalizing line endings
   * and extracting useful metadata for each line.
   * @param yamlString The YAML string to tokenize.
   * @returns An array of TokenizedLine objects.
   */
  public static tokenize(yamlString: string): TokenizedLine[] {
    // Normalize all types of line endings to '\n'
    const normalized = yamlString.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rawLines = normalized.split('\n');
    const tokenizedLines: TokenizedLine[] = [];

    rawLines.forEach((original, index) => {
      const lineNumber = index + 1;
      const trimmedRight = original.replace(/\s+$/, '');
      const trimmed = trimmedRight.trim();
      const isBlank = trimmed === '';
      const isComment = trimmed.startsWith('#');
      const isDirective = trimmed.startsWith('%');
      const isDocumentMarker = /^---|^\.\.\./.test(trimmed);
      let content = trimmedRight;

      if (!isBlank && !isComment) {
        content = this.removeInlineComments(trimmedRight);
      }

      const indent = this.calculateIndent(original);

      tokenizedLines.push({
        original,
        content: content.trim(),
        indent,
        isComment,
        isBlank,
        lineNumber,
        isDirective,
        isDocumentMarker,
      });
    });

    return tokenizedLines;
  }

  /**
   * Removes inline comments from a line, ensuring that '#' characters
   * within quotes are preserved.
   * @param line The YAML line.
   * @returns The line without inline comments.
   */
  private static removeInlineComments(line: string): string {
    let result = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const prevChar = i > 0 ? line[i - 1] : null;

      if (char === "'" && !inDoubleQuote && prevChar !== '\\') {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote && prevChar !== '\\') {
        inDoubleQuote = !inDoubleQuote;
      }

      if (char === '#' && !inSingleQuote && !inDoubleQuote) {
        break; // Ignore the rest of the line
      }

      result += char;
    }

    return result;
  }

  /**
   * Calculates indentation by counting leading spaces in the line.
   * Converts tabs to spaces (assumed as 2 spaces per tab).
   * @param line The YAML line.
   * @returns The indentation level as a number.
   */
  private static calculateIndent(line: string): number {
    const indentMatch = line.match(/^(\s*)/);
    if (!indentMatch) {
      return 0;
    }

    const spaces = indentMatch[1].replace(/\t/g, '  ').length;
    return spaces;
  }
}
