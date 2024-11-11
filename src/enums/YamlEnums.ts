/**
 * Enum for node types in the parsing stack.
 */
export enum NodeType {
  Map = 'map',
  Sequence = 'sequence',
}

/**
 * Enum for scalar styles in multi-line strings.
 */
export enum ScalarStyle {
  Literal = '|',
  Folded = '>',
}
