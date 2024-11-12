import { NodeType, ScalarStyle } from '../enums';
import { YAMLValue } from '../types';

/**
 * Interface representing a Yaml parser that can read and write YAML data.
 */
export interface IYamlParser {
  /**
   * Parses a YAML string into a JavaScript object.
   * @param yaml The YAML string to parse.
   * @returns The parsed JavaScript object.
   */
  parse(yaml: string): YAMLValue;

  /**
   * Converts a JavaScript object into a YAML string.
   * @param obj The JavaScript object to convert.
   * @returns The YAML string.
   */
  stringify(data: YAMLValue): string;
}

/**
 * Represents a YAML mapping (similar to JavaScript objects).
 */
export interface YAMLMap {
  [key: string]: YAMLValue;
}

/**
 * Represents a YAML sequence (similar to JavaScript arrays).
 */
export interface YAMLSequence extends Array<YAMLValue> {}

export interface SequenceStackElement {
  indent: number;
  obj: YAMLSequence;
  type: NodeType.Sequence;
  key?: string;
}

export interface MapStackElement {
  indent: number;
  obj: YAMLMap;
  type: NodeType.Map;
  key?: string;
}

export type StackElement = SequenceStackElement | MapStackElement;

/**
 * Represents the state of multi-line string parsing.
 */
export interface MultiLineState {
  key: string;
  type: ScalarStyle;
  baseIndent: number;
  lines: string[];
  parentSequence?: YAMLSequence;
}
