// src/utils/ValueParser.ts

import { ScalarStyle } from '../enums';
import { ParsingError } from '../errors';

export class ValueParser {
  public static parseInlineCollection(value: string): any {
    const trimmed = value.trim();

    // Early return for empty string
    if (trimmed === '') return '';

    // Strip YAML tags if present
    const tagRemoved = this.stripYAMLTags(trimmed);

    // Handle arrays, objects, or scalar values
    return this.parseValue(tagRemoved);
  }

  private static stripYAMLTags(value: string): string {
    // Remove YAML tags like !!binary
    return value.replace(/^!!\w+\s*/, '');
  }

  private static parseValue(value: string): any {
    const trimmedValue = value.trim();

    // Handle sequence indicators (lines starting with '- ')
    if (trimmedValue.startsWith('- ')) {
      // Parse the sequence items
      const items = [];
      let currentItem = trimmedValue;
      while (currentItem.startsWith('- ')) {
        const index = currentItem.indexOf('\n- ', 2);
        let item;
        if (index !== -1) {
          item = currentItem.substring(2, index).trim();
          currentItem = currentItem.substring(index + 1).trim();
        } else {
          item = currentItem.substring(2).trim();
          currentItem = '';
        }
        items.push(this.parseValue(item));
      }
      return items;
    }
    if (this.hasUnclosedQuotes(value)) {
      throw new ParsingError(`Unclosed quote in value: "${value}"`, value);
    }

    if (this.hasMismatchedBracketsOrBraces(value)) {
      throw new ParsingError(
        `Mismatched brackets or braces in value: "${value}"`,
        value,
      );
    }

    if (this.isQuotedString(value)) {
      return this.parseQuotedValue(value);
    }

    if (this.isArray(value)) {
      return this.parseArray(value);
    }

    if (this.isObject(value)) {
      return this.parseObject(value);
    }

    if (this.isInlineMapping(value)) {
      return this.parseInlineMapping(value);
    }

    return this.parseScalar(value);
  }

  private static isQuotedString(value: string): boolean {
    return (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    );
  }

  private static isArray(value: string): boolean {
    return value.startsWith('[') && value.endsWith(']');
  }

  private static isObject(value: string): boolean {
    return value.startsWith('{') && value.endsWith('}');
  }

  private static isInlineMapping(value: string): boolean {
    return value.includes(':');
  }

  private static parseQuotedValue(value: string): any {
    const parsedString = this.parseQuotedString(value);
    return this.isIsoDateString(parsedString)
      ? new Date(parsedString)
      : parsedString;
  }

  private static hasUnclosedQuotes(value: string): boolean {
    const state = {
      inSingleQuote: false,
      inDoubleQuote: false,
      isEscaped: false,
    };

    for (const char of value) {
      this.updateParsingState(char, state);
    }

    return state.inSingleQuote || state.inDoubleQuote;
  }

  private static hasMismatchedBracketsOrBraces(value: string): boolean {
    const state = {
      inSingleQuote: false,
      inDoubleQuote: false,
      isEscaped: false,
      bracketCount: 0,
      braceCount: 0,
    };

    for (const char of value) {
      this.updateParsingState(char, state);

      if (state.bracketCount < 0 || state.braceCount < 0) {
        return true; // Found closing bracket/brace without matching opening one
      }
    }

    return state.bracketCount !== 0 || state.braceCount !== 0;
  }

  private static updateParsingState(char: string, state: any): void {
    if (state.isEscaped) {
      state.isEscaped = false;
    } else if (char === '\\') {
      state.isEscaped = true;
    } else if (char === "'" && !state.inDoubleQuote) {
      state.inSingleQuote = !state.inSingleQuote;
    } else if (char === '"' && !state.inSingleQuote) {
      state.inDoubleQuote = !state.inDoubleQuote;
    } else if (!state.inSingleQuote && !state.inDoubleQuote) {
      if (char === '[') state.bracketCount++;
      else if (char === ']') state.bracketCount--;
      else if (char === '{') state.braceCount++;
      else if (char === '}') state.braceCount--;
    }
  }

  private static parseQuotedString(value: string): string {
    const quoteChar = value[0];
    let result = '';
    let isEscaped = false;

    for (let i = 1; i < value.length - 1; i++) {
      const char = value[i];

      if (isEscaped) {
        result += this.getEscapedChar(char, quoteChar);
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else {
        result += char;
      }
    }

    return result;
  }

  private static getEscapedChar(char: string, quoteChar: string): string {
    switch (char) {
      case quoteChar:
      case '\\':
        return char;
      case 'n':
        return '\n';
      case 't':
        return '\t';
      default:
        return '\\' + char; // Unknown escape sequence
    }
  }

  private static parseInlineMapping(value: string): object {
    const obj: any = {};
    const colonIndex = this.findUnquotedColon(value);

    if (colonIndex === -1)
      throw new ParsingError(`Invalid mapping: "${value}"`, value);

    const keyPart = value.slice(0, colonIndex).trim();
    const valuePart = value.slice(colonIndex + 1).trim();

    const parsedKey = this.parseValue(keyPart);

    let parsedValue: any;
    if (valuePart === '') {
      parsedValue = null; // Assign null to defer value assignment
    } else {
      parsedValue = this.parseValue(valuePart);
    }

    obj[parsedKey] = parsedValue;

    return obj;
  }

  private static parseArray(value: string): any[] {
    const inner = value.slice(1, -1).trim();
    if (inner === '') return [];

    const items = this.splitByComma(inner);
    return items.map((item) => this.parseValue(item));
  }

  private static parseObject(value: string): object {
    const inner = value.slice(1, -1).trim();
    if (inner === '') return {};

    const items = this.splitByComma(inner);
    const obj: any = {};

    items.forEach((item) => {
      const colonIndex = this.findUnquotedColon(item);
      if (colonIndex === -1)
        throw new ParsingError(`Invalid mapping: "${item}"`, item);

      const keyPart = item.slice(0, colonIndex).trim();
      const valuePart = item.slice(colonIndex + 1).trim();

      const parsedKey = this.parseScalar(keyPart); // Using parseScalar for keys
      const parsedValue = this.parseValue(valuePart);
      obj[parsedKey] = parsedValue;
    });

    return obj;
  }

  private static parseScalar(value: string): any {
    const strippedValue = this.stripYAMLTags(value);

    if (this.hasUnclosedQuotes(strippedValue)) {
      throw new ParsingError(
        `Unclosed quote in value: "${strippedValue}"`,
        strippedValue,
      );
    }

    // Handle block scalars (multi-line strings)
    if (
      strippedValue === ScalarStyle.Literal ||
      strippedValue === ScalarStyle.Folded
    ) {
      // Return a special token or handle accordingly
      return strippedValue;
    }

    // Handle quoted strings
    if (
      (strippedValue.startsWith('"') && strippedValue.endsWith('"')) ||
      (strippedValue.startsWith("'") && strippedValue.endsWith("'"))
    ) {
      return this.parseQuotedString(strippedValue);
    }

    // Handle null
    if (['null', '~'].includes(strippedValue)) {
      return null;
    }

    // Handle booleans
    if (['true', 'false'].includes(strippedValue)) {
      return strippedValue === 'true';
    }

    // Handle numbers
    const numberValue = this.parseNumber(strippedValue);
    if (numberValue !== undefined) return numberValue;

    // Handle special floating-point values
    const specialFloat = this.parseSpecialFloat(strippedValue);
    if (specialFloat !== undefined) return specialFloat;

    // Check for invalid starting characters
    if (this.startsWithProhibitedChar(strippedValue)) {
      throw new ParsingError(
        `Unexpected token: "${strippedValue}"`,
        strippedValue,
      );
    }

    // Return as string if no other rules match
    return strippedValue;
  }

  private static parseNumber(value: string): number | undefined {
    if (/^[-+]?0o[0-7]+$/.test(value)) {
      // Octal with 0o prefix
      return (
        parseInt(value.slice(value.startsWith('-') ? 3 : 2), 8) *
        (value.startsWith('-') ? -1 : 1)
      );
    }

    if (/^[-+]?0[0-7]+$/.test(value)) {
      // Octal with leading zero
      return parseInt(value, 8);
    }

    if (/^[-+]?0x[0-9a-fA-F]+$/.test(value)) {
      // Hexadecimal
      return parseInt(value, 16);
    }

    if (/^[-+]?0b[01]+$/.test(value)) {
      // Binary
      return (
        parseInt(value.slice(value.startsWith('-') ? 3 : 2), 2) *
        (value.startsWith('-') ? -1 : 1)
      );
    }

    // Decimal integers
    if (/^[-+]?[0-9]+$/.test(value)) {
      return parseInt(value, 10);
    }

    // Decimal floating-point numbers
    if (
      /^[-+]?[0-9]*\.[0-9]+$/.test(value) ||
      /^[-+]?[0-9]+\.[0-9]*$/.test(value)
    ) {
      return parseFloat(value);
    }

    // Exponential notation
    if (/^[-+]?[0-9]+(?:\.[0-9]*)?[eE][-+]?[0-9]+$/.test(value)) {
      return Number(value);
    }

    // No matching number format
    return undefined;
  }

  private static parseSpecialFloat(value: string): number | undefined {
    if (/^[+-]?\.inf$/i.test(value)) {
      return value.startsWith('-') ? -Infinity : Infinity;
    }
    if (/^\.nan$/i.test(value)) {
      return NaN;
    }
    return undefined;
  }

  private static startsWithProhibitedChar(value: string): boolean {
    const prohibitedChars = '?:,[]{}#&*!|>\'"%@`';
    // Allow '-' if it's followed by a space (sequence indicator)
    if (value.startsWith('- ')) {
      return false;
    }
    return value.length > 0 && prohibitedChars.includes(value[0]);
  }

  private static isIsoDateString(value: string): boolean {
    const iso8601DateRegex = /^\d{4}-\d{2}-\d{2}(?:[Tt ][\d:.+\-Z]+)?$/;
    return iso8601DateRegex.test(value);
  }

  private static splitByComma(str: string): string[] {
    const items: string[] = [];
    let current = '';
    const state = {
      inSingleQuote: false,
      inDoubleQuote: false,
      isEscaped: false,
      bracketCount: 0,
      braceCount: 0,
      parenCount: 0, // To handle parentheses if needed
    };

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      this.updateParsingState(char, state);

      if (
        char === ',' &&
        state.bracketCount === 0 &&
        state.braceCount === 0 &&
        state.parenCount === 0 &&
        !state.inSingleQuote &&
        !state.inDoubleQuote &&
        !state.isEscaped
      ) {
        items.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim() !== '') {
      items.push(current.trim());
    }

    if (state.inSingleQuote || state.inDoubleQuote) {
      throw new ParsingError(`Unclosed quote in value: "${str}"`, str);
    }

    if (state.bracketCount !== 0 || state.braceCount !== 0) {
      throw new ParsingError(
        `Mismatched brackets or braces in value: "${str}"`,
        str,
      );
    }

    return items;
  }
  private static findUnquotedColon(str: string): number {
    const state = {
      inSingleQuote: false,
      inDoubleQuote: false,
      isEscaped: false,
    };

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      this.updateParsingState(char, state);

      if (
        char === ':' &&
        !state.inSingleQuote &&
        !state.inDoubleQuote &&
        !state.isEscaped
      ) {
        return i;
      }
    }

    return -1;
  }
}
