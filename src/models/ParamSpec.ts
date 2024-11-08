/**
 * Defines the specification for a parameter used in a Kubernetes or Tekton resource.
 * Specifies the name, type, default value, and optional description of the parameter.
 */
export interface ParamSpec {
  /**
   * The name of the parameter.
   */
  name: string;

  /**
   * The expected data type of the parameter's value.
   * - `'string'` for single string values
   * - `'array'` for an array of strings
   * - `'object'` for a key-value object
   */
  type?: 'string' | 'array' | 'object';

  /**
   * The default value for the parameter if no value is provided.
   * Can be a string, an array of strings, or a key-value object, depending on the `type` specified.
   */
  default?: string | string[] | { [key: string]: any };

  /**
   * An optional description providing more context about the purpose and usage of the parameter.
   */
  description?: string;
}
