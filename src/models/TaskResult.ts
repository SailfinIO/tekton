/**
 * Represents a result produced by a Tekton Task, which can be used as output data from the task.
 * Each `TaskResult` has a name and can optionally specify a type and description.
 */
export interface TaskResult {
  /**
   * The name of the result, used to reference this output within the task.
   */
  name: string;

  /**
   * The expected data type of the result, which can be:
   * - `'string'` for single string values
   * - `'array'` for an array of values
   * - `'object'` for a key-value object
   *
   * Defaults to `'string'` if not specified.
   */
  type?: 'string' | 'array' | 'object';

  /**
   * An optional description providing additional context about the purpose of the result.
   * Useful for documentation purposes to clarify what this result represents.
   */
  description?: string;
}
