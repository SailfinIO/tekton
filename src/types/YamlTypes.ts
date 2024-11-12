import { YAMLMap, YAMLSequence } from '../interfaces';

/**
 * Represents the primitive YAML data types.
 */
export type YAMLPrimitive = string | number | boolean | null;

/**
 * Represents any valid YAML value, recursively including maps and sequences.
 */
export type YAMLValue = YAMLPrimitive | YAMLMap | YAMLSequence;
