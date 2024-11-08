/**
 * Represents a conditional expression in Tekton, used to determine whether a task should run based on specified criteria.
 * A `WhenExpression` evaluates an input against a set of values using an operator.
 */
export interface WhenExpression {
  /**
   * The input parameter or value to evaluate in the conditional expression.
   * This value will be checked against the specified `values` array using the defined `operator`.
   */
  input: string;

  /**
   * The operator used to compare the `input` to the `values`.
   * - `'in'`: The task will run if the `input` is contained within the `values` array.
   * - `'notin'`: The task will run if the `input` is not contained within the `values` array.
   */
  operator: 'in' | 'notin';

  /**
   * An array of values to compare against the `input`.
   * The `operator` determines whether the task will run based on whether `input` is in or not in this array.
   */
  values: string[];
}
