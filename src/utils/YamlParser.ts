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

    if (this.handleMultiLineScalars(line)) {
      return;
    }

    const currentElement = this.getCurrentElement();

    if (line.content.startsWith('- ')) {
      this.handleSequence(line, currentElement);
    } else {
      // Check if current element is a sequence
      if (currentElement.type === NodeType.Sequence) {
        // Handle mapping within a sequence
        const newMap: YAMLMap = {};
        (currentElement.obj as YAMLSequence).push(newMap);
        const newStackElement: MapStackElement = {
          indent: line.indent,
          obj: newMap,
          type: NodeType.Map,
          key: null,
        };
        this._stack.push(newStackElement);
        // Process the mapping within the sequence
        this.processLine(line);
      } else {
        this.handleMapping(line, currentElement);
      }
    }
  }

  private handleMultiLineScalars(line: TokenizedLine): boolean {
    if (this.isMultiLineScalarStart(line)) {
      this.startMultiLineScalar(line);
      return true;
    }

    if (this.multiLineState) {
      this.continueMultiLineScalar(line);
      return true;
    }

    return false;
  }

  private getCurrentElement(): StackElement {
    return this._stack[this._stack.length - 1];
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
    const currentElement = this._stack[this._stack.length - 1];
    (currentElement.obj as YAMLMap)[this.multiLineState.key] = '';
  }

  private continueMultiLineScalar(line: TokenizedLine): void {
    if (line.indent >= this.multiLineState!.baseIndent) {
      const content = line.original.slice(this.multiLineState!.baseIndent);
      this.multiLineState!.lines.push(content);
    } else {
      this.endMultiLineScalar();
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
      return;
    }

    if (currentElement.type !== NodeType.Sequence) {
      this.logger.warn(
        `Cannot handle sequence at line ${line.lineNumber} because current element is not a Map or Sequence`,
      );
      return;
    }

    this.addToCurrentSequence(currentElement, seqItem, line.indent);
  }

  private addToCurrentSequence(
    currentElement: StackElement,
    seqItem: YAMLValue,
    indent: number,
  ): void {
    const seq = currentElement.obj as YAMLSequence;
    seq.push(seqItem);
    this.updateStackWithSeqItem(seqItem, indent);
  }

  private handleSequenceInMap(
    currentElement: StackElement,
    seqItem: YAMLValue,
    indent: number,
    lineNumber: number,
  ): void {
    const map = currentElement.obj as YAMLMap;
    const key = currentElement.key;

    // **New Code: Handle special case where seqItem is { key: null }**
    if (
      typeof seqItem === 'object' &&
      seqItem !== null &&
      Object.keys(seqItem).length === 1 &&
      Object.keys(seqItem)[0] === key &&
      seqItem[key] === null
    ) {
      // Initialize the key with an empty array
      map[key] = [];
      this.pushNewStackElement(map[key], indent);
      return;
    }

    if (key === null) {
      // Handle sequences within sequences or other complex cases
      const seq: YAMLSequence = [];
      seq.push(seqItem);

      const parentElement = this._stack[this._stack.length - 2];

      if (parentElement.type === NodeType.Map && parentElement.obj) {
        const parentMap = parentElement.obj as YAMLMap;
        const parentKey = Object.keys(parentMap).find(
          (k) => parentMap[k] === map,
        );

        if (parentKey !== undefined) {
          parentMap[parentKey] = seq;
        } else {
          throw new ParsingError(
            `Cannot find key in parent map to update at line ${lineNumber}`,
            '',
          );
        }
      } else if (parentElement.type === NodeType.Sequence) {
        const parentSeq = parentElement.obj as YAMLSequence;
        parentSeq[parentSeq.length - 1] = seq;
      } else {
        throw new ParsingError(
          `Parent element is not a map or sequence at line ${lineNumber}`,
          '',
        );
      }

      currentElement.obj = seq;
      currentElement.type = NodeType.Sequence;
      this._stack[this._stack.length - 1] = currentElement;
      this.updateStackWithSeqItem(seqItem, indent);
      return;
    }

    // Handle sequence items within a map
    const seq = this.getOrCreateSequence(map, key, lineNumber);
    if (!seq) {
      return;
    }

    // Regular sequence item handling
    seq.push(seqItem);
    this.updateStackWithSeqItem(seqItem, indent);
  }

  private getOrCreateSequence(
    map: YAMLMap,
    key: string,
    lineNumber: number,
  ): YAMLSequence | null {
    const existingValue = map[key];

    if (Array.isArray(existingValue)) {
      return existingValue as YAMLSequence;
    }

    if (
      existingValue === undefined ||
      existingValue === null ||
      this.isEmptyObject(existingValue)
    ) {
      const seq: YAMLSequence = [];
      map[key] = seq;
      return seq;
    }

    if (this.isNestedObject(existingValue)) {
      const seq: YAMLSequence = [existingValue];
      map[key] = seq;
      return seq;
    }

    this.logger.warn(
      `Cannot assign sequence to key '${key}' because it's already assigned a non-sequence value at line ${lineNumber}`,
    );
    return null;
  }

  private updateStackWithSeqItem(seqItem: YAMLValue, indent: number): void {
    if (Array.isArray(seqItem)) {
      this.pushNewStackElement(seqItem as YAMLSequence, indent);
    } else if (this.isNestedObject(seqItem)) {
      this.pushNewStackElement(seqItem as YAMLMap, indent);

      // Handle keys with null or undefined values
      const seqItemMap = seqItem as YAMLMap;
      for (const [key, value] of Object.entries(seqItemMap)) {
        if (value === null || value === undefined) {
          // Assign an empty map to the key
          const newMap: YAMLMap = {};
          seqItemMap[key] = newMap;

          // Push new stack element for this map
          const newStackElement: MapStackElement = {
            indent,
            obj: newMap,
            type: NodeType.Map,
            key: key,
          };
          this._stack.push(newStackElement);
        }
      }
    }
  }

  private pushNewStackElement(
    obj: YAMLMap | YAMLSequence,
    indent: number,
  ): void {
    if (Array.isArray(obj)) {
      const newStackElement: SequenceStackElement = {
        indent,
        obj: obj as YAMLSequence,
        type: NodeType.Sequence,
        key: null,
      };
      this._stack.push(newStackElement);
    } else {
      const newStackElement: MapStackElement = {
        indent,
        obj: obj as YAMLMap,
        type: NodeType.Map,
        key: null, // Initialize key to null
      };
      this._stack.push(newStackElement);
    }
  }

  private isEmptyObject(value: any): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0
    );
  }

  private handleMapping(
    line: TokenizedLine,
    currentElement: StackElement,
  ): void {
    const [key, valuePart] = this.extractKeyValue(line);
    this.assignValue(currentElement, key, valuePart, line.indent);
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

  private assignValue(
    currentElement: SequenceStackElement | MapStackElement,
    key: string,
    valuePart: string,
    indent: number,
  ): void {
    let value: YAMLValue;
    if (valuePart === '') {
      value = {};
      (currentElement.obj as YAMLMap)[key] = value;
      this.pushNewStackElement(value as YAMLMap, indent);
      // Set currentElement.key to the key
      currentElement.key = key;
      // Do not reset currentElement.key to null here
    } else {
      value = ValueParser.parseInlineCollection(valuePart);
      (currentElement.obj as YAMLMap)[key] = value;
      if (this.isComplexStructure(value)) {
        this.pushNewStackElement(value as YAMLMap | YAMLSequence, indent);
      }
      // Reset currentElement.key to null after assigning the value
      currentElement.key = null;
    }
  }

  private isComplexStructure(value: YAMLValue): boolean {
    return this.isNestedObject(value) || Array.isArray(value);
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

    if (this.isNestedObject(data)) {
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
