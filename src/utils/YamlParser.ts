// src/utils/YamlParser.ts

import {
  IYamlParser,
  YAMLMap,
  YAMLSequence,
  StackElement,
  MultiLineState,
  ILogger,
  MapStackElement,
  SequenceStackElement,
} from '../interfaces';
import { YAMLValue } from '../types';
import { Tokenizer } from './Tokenizer';
import { ValueParser } from './ValueParser';
import { TokenizedLine } from '../interfaces';
import { NodeType, ScalarStyle } from '../enums';
import { ParsingError, SerializationError } from '../errors';
import { Logger } from './Logger';

export class YamlParser implements IYamlParser {
  private readonly logger: ILogger = new Logger(YamlParser.name);
  private _stack: StackElement[];
  private _multiLineState: MultiLineState | null;
  private readonly _indentSize: number = 2;

  constructor() {
    this._stack = [{ indent: -1, obj: {}, type: NodeType.Map }];
    this._multiLineState = null;
  }

  // Getters and Setters
  public get stack(): StackElement[] {
    return this._stack;
  }

  public set stack(value: StackElement[]) {
    this._stack = value;
  }

  public get multiLineState(): MultiLineState | null {
    return this._multiLineState;
  }

  public set multiLineState(value: MultiLineState | null) {
    this._multiLineState = value;
  }

  public get indentSize(): number {
    return this._indentSize;
  }

  public parse(yaml: string): YAMLValue {
    this.validateInput(yaml);

    const tokenizedLines = Tokenizer.tokenize(yaml);
    for (const line of tokenizedLines) {
      if (line.isDirective) {
        this.handleDirective(line);
      } else if (!line.isDocumentMarker && !line.isBlank && !line.isComment) {
        this.processLine(line);
      } else if (this.multiLineState) {
        this.continueMultiLineScalar(line);
      }
    }

    // Handle multi-line scalar at the end of the file
    if (this.multiLineState) {
      this.endMultiLineScalar();
    }

    return this._stack[0].obj;
  }

  private validateInput(yaml: string): void {
    if (typeof yaml !== 'string' || yaml.trim() === '') {
      throw new ParsingError(
        'Invalid input: YAML string must be a non-empty string.',
        yaml,
      );
    }
  }

  private handleDirective(line: TokenizedLine): void {
    const parts = line.content.split(' ');
    if (parts[0] === '%YAML' && parts.length === 2) {
      this.logger.info(`YAML Directive found: ${parts[1]}`);
    } else {
      this.logger.warn(
        `Unsupported directive at line ${line.lineNumber}: ${line.content}`,
      );
    }
  }

  private processLine(line: TokenizedLine): void {
    this.popStackToMatchIndent(line);

    // Handle multi-line scalar start
    if (this.isMultiLineScalarStart(line)) {
      this.startMultiLineScalar(line);
      return;
    }

    // Handle continuation of multi-line scalar
    if (this.multiLineState) {
      this.continueMultiLineScalar(line);
      return;
    }

    const currentElement = this._stack[this._stack.length - 1];
    if (line.content.startsWith('- ')) {
      this.handleSequence(line, currentElement);
    } else {
      this.handleMapping(line, currentElement);
    }
  }

  private isMultiLineScalarStart(line: TokenizedLine): boolean {
    return /:\s*[|>]/.test(line.content);
  }

  private startMultiLineScalar(line: TokenizedLine): void {
    const [key, indicator] = line.content.split(/:\s*/, 2);
    const style =
      indicator.trim() === '|' ? ScalarStyle.Literal : ScalarStyle.Folded;
    this.multiLineState = {
      key: key.trim(),
      type: style,
      baseIndent: line.indent + this._indentSize,
      lines: [],
    };
    // Initialize the key with an empty string
    const currentElement = this._stack[this._stack.length - 1];
    (currentElement.obj as YAMLMap)[this.multiLineState.key] = '';
  }

  private continueMultiLineScalar(line: TokenizedLine): void {
    if (line.indent >= this.multiLineState!.baseIndent) {
      const content = line.original.slice(this.multiLineState!.baseIndent);
      this.multiLineState!.lines.push(content);
    } else {
      // End of multi-line scalar
      this.endMultiLineScalar();

      // Re-process the current line as it might be a new key or sequence
      this.processLine(line);
    }
  }

  private endMultiLineScalar(): void {
    const value = this.multiLineState!.lines.join('\n');
    const currentElement = this._stack[this._stack.length - 1];
    (currentElement.obj as YAMLMap)[this.multiLineState!.key] = value;
    this.multiLineState = null;
  }

  private popStackToMatchIndent(line: TokenizedLine): void {
    while (
      this._stack.length > 1 &&
      line.indent <= this._stack[this._stack.length - 1].indent
    ) {
      this._stack.pop();
    }
  }

  private handleSequence(
    line: TokenizedLine,
    currentElement: StackElement,
  ): void {
    const seqItem = ValueParser.parseInlineCollection(line.content.slice(2));

    if (currentElement.type === NodeType.Map) {
      this.handleSequenceInMap(
        currentElement,
        seqItem,
        line.indent,
        line.lineNumber,
      );
    } else if (currentElement.type === NodeType.Sequence) {
      const seq = currentElement.obj as YAMLSequence;
      seq.push(seqItem);

      // Update the stack if seqItem is a complex structure
      if (Array.isArray(seqItem)) {
        const newStackElement: SequenceStackElement = {
          indent: line.indent,
          obj: seqItem as YAMLSequence,
          type: NodeType.Sequence,
          key: null,
        };
        this._stack.push(newStackElement);
      } else if (typeof seqItem === 'object' && seqItem !== null) {
        const newStackElement: MapStackElement = {
          indent: line.indent,
          obj: seqItem as YAMLMap,
          type: NodeType.Map,
          key: null,
        };
        this._stack.push(newStackElement);
      }
    } else {
      this.logger.warn(
        `Cannot handle sequence at line ${line.lineNumber} because current element is not a Map or Sequence`,
      );
    }
  }

  private handleSequenceInMap(
    currentElement: StackElement,
    seqItem: YAMLValue,
    indent: number,
    lineNumber: number,
  ): void {
    const map = currentElement.obj as YAMLMap;
    const key = currentElement.key;

    if (key !== null) {
      let seq: YAMLSequence;

      if (Array.isArray(map[key])) {
        seq = map[key] as YAMLSequence;
      } else if (map[key] === undefined) {
        seq = [];
        map[key] = seq;
      } else if (typeof map[key] === 'object' && map[key] !== null) {
        if (Object.keys(map[key] as YAMLMap).length === 0) {
          // Replace empty map with array
          seq = [];
          map[key] = seq;
        } else {
          seq = [];
          seq.push(map[key]);
          map[key] = seq;
        }
      } else {
        this.logger.warn(
          `Cannot assign sequence to key '${key}' because it's already assigned a non-sequence value at line ${lineNumber}`,
        );
        return;
      }

      seq.push(seqItem);

      // Update the stack if seqItem is a complex structure
      if (Array.isArray(seqItem)) {
        const newStackElement: SequenceStackElement = {
          indent,
          obj: seqItem as YAMLSequence,
          type: NodeType.Sequence,
          key: null,
        };
        this._stack.push(newStackElement);
      } else if (typeof seqItem === 'object' && seqItem !== null) {
        const newStackElement: MapStackElement = {
          indent,
          obj: seqItem as YAMLMap,
          type: NodeType.Map,
          key: null,
        };
        this._stack.push(newStackElement);
      }
    } else {
      this.logger.warn(
        `No key found to assign the sequence item at line ${lineNumber}`,
      );
    }
  }

  private handleMapping(
    line: TokenizedLine,
    currentElement: StackElement,
  ): void {
    const [key, valuePart] = this.extractKeyValue(line);
    if (valuePart === '') {
      this.assignEmptyMap(currentElement, key, line.indent);
    } else {
      this.assignValue(currentElement, key, valuePart, line.indent);
    }
  }

  private extractKeyValue(line: TokenizedLine): [string, string] {
    const colonIndex = line.content.indexOf(':');
    if (colonIndex === -1) {
      throw new ParsingError(
        `Invalid mapping at line ${line.lineNumber}`,
        line.content,
      );
    }

    const key = ValueParser.parseInlineCollection(
      line.content.slice(0, colonIndex).trim(),
    );
    if (typeof key !== 'string') {
      throw new ParsingError(
        `Invalid key type at line ${line.lineNumber}`,
        key,
      );
    }

    return [key, line.content.slice(colonIndex + 1).trim()];
  }

  private assignEmptyMap(
    currentElement: StackElement,
    key: string,
    indent: number,
  ): void {
    if (currentElement.type !== NodeType.Map) {
      throw new ParsingError(
        `Cannot assign key '${key}' to a non-Map element at indent ${indent}`,
        '',
      );
    }

    // Do not assign any value yet
    currentElement.key = key; // Store the key for later assignment

    // Create a new stack element to hold the pending key
    const newStackElement: StackElement = {
      indent,
      obj: currentElement.obj,
      type: NodeType.Map,
      key: key, // Keep track of the pending key
    };

    this._stack.push(newStackElement);
  }

  private assignValue(
    currentElement: StackElement,
    key: string,
    valuePart: string,
    indent: number,
  ): void {
    const value = ValueParser.parseInlineCollection(valuePart);
    (currentElement.obj as YAMLMap)[key] = value;
    currentElement.key = key;

    if (this.isNestedObject(value) || Array.isArray(value)) {
      this._stack.push({
        indent,
        obj: value as YAMLMap,
        type: NodeType.Map,
        key,
      });
    }
  }

  private isNestedObject(value: YAMLValue): boolean {
    return typeof value === 'object' && !Array.isArray(value) && value !== null;
  }

  public stringify(data: YAMLValue, indentLevel: number = 0): string {
    try {
      return this.stringifyData(data, indentLevel);
    } catch (error) {
      this.handleSerializationError(error, data);
    }
  }

  private stringifyData(data: YAMLValue, indentLevel: number): string {
    if (this.isPrimitive(data)) {
      return this.formatPrimitive(data);
    }

    if (Array.isArray(data)) {
      return this.stringifyArray(data, indentLevel);
    }

    if (typeof data === 'object' && data !== null) {
      return this.stringifyObject(data as YAMLMap, indentLevel);
    }

    throw new SerializationError('Unsupported data type.', data);
  }

  private isPrimitive(data: YAMLValue): boolean {
    return (
      typeof data === 'string' ||
      typeof data === 'number' ||
      typeof data === 'boolean' ||
      data === null
    );
  }

  private formatPrimitive(data: YAMLValue): string {
    if (typeof data === 'string') {
      return this.needsQuoting(data) ? `"${data}"` : data;
    }
    return String(data);
  }

  private stringifyArray(data: YAMLSequence, indentLevel: number): string {
    if (data.length === 0) return '[]';

    const items = data.map((item) =>
      this.stringifyArrayItem(item, indentLevel),
    );

    return items.join('\n');
  }

  private stringifyArrayItem(item: YAMLValue, indentLevel: number): string {
    const indent = ' '.repeat(this._indentSize * indentLevel);

    if (Array.isArray(item)) {
      // Handle nested arrays without extra indentation
      const nestedItems = item
        .map((nestedItem) =>
          this.stringifyArrayItem(nestedItem, indentLevel + 1),
        )
        .join('\n');
      return `${indent}- ${nestedItems.trim()}`;
    } else if (this.isNestedObject(item)) {
      // Handle nested objects
      const itemString = this.stringifyData(item, indentLevel + 1);
      return `${indent}- ${itemString.trim()}`;
    } else {
      const itemString = this.stringifyData(item, indentLevel);
      return `${indent}- ${itemString}`;
    }
  }

  private stringifyObject(data: YAMLMap, indentLevel: number): string {
    const keys = Object.keys(data);
    if (keys.length === 0) return '{}';

    const entries = keys.map((key) =>
      this.formatObjectEntry(data, key, indentLevel),
    );

    return entries.join('\n');
  }

  private formatObjectEntry(
    data: YAMLMap,
    key: string,
    indentLevel: number,
  ): string {
    const indent = ' '.repeat(this._indentSize * indentLevel);
    const val = data[key];
    const formattedKey = this.needsQuoting(key) ? `"${key}"` : key;

    if (this.isEmptyCollection(val)) {
      return `${indent}${formattedKey}: ${this.formatEmptyCollection(val)}`;
    }

    if (this.isNestedObject(val) || Array.isArray(val)) {
      const nestedContent = this.stringifyData(val, indentLevel + 1);
      return `${indent}${formattedKey}:\n${nestedContent}`;
    }

    return `${indent}${formattedKey}: ${this.stringifyData(val, indentLevel)}`;
  }

  private isEmptyCollection(val: YAMLValue): boolean {
    return (
      (Array.isArray(val) && val.length === 0) ||
      (this.isNestedObject(val) && Object.keys(val as YAMLMap).length === 0)
    );
  }

  private formatEmptyCollection(val: YAMLValue): string {
    return Array.isArray(val) ? '[]' : '{}';
  }

  private needsQuoting(str: string): boolean {
    return /[:{}\[\],&*#?|\-<>@\%`]/.test(str) || /\s/.test(str);
  }

  private handleSerializationError(error: Error, data: YAMLValue): void {
    if (error instanceof SerializationError) {
      this.logger.error(error.message, error);
      throw error;
    }
    const serializationError = new SerializationError(
      'Serialization failed.',
      data,
    );
    this.logger.error(serializationError.message, serializationError);
    throw serializationError;
  }
}
