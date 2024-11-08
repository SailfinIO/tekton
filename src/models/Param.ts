/**
 * Represents a parameter for a Kubernetes or Tekton resource.
 * A parameter is a configurable key-value pair, which can be a single value, an array of values, or a key-value object.
 */
export interface Param {
  /**
   * The name of the parameter.
   */
  name: string;

  /**
   * The value of the parameter, which can be:
   * - A single string
   * - An array of strings
   * - An object with key-value pairs for more complex data structures
   */
  value: string | string[] | { [key: string]: any };
}
