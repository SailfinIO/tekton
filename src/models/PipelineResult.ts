/**
 * Represents a result produced by a Tekton Pipeline.
 * Defines the name, description, and value of the result, which can be used as output from a pipeline.
 */
export interface PipelineResult {
  /**
   * The name of the result.
   * This is used to reference the result within the pipeline.
   */
  name: string;

  /**
   * An optional description providing more context about the result.
   * Useful for documentation purposes to clarify the meaning or purpose of the result.
   */
  description?: string;

  /**
   * The value of the result, which can contain the output or data produced by the pipeline.
   */
  value: string;
}
