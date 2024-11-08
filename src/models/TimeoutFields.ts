/**
 * Specifies timeout settings for different phases of a Tekton PipelineRun.
 * Each timeout value is represented as a string in ISO 8601 duration format (e.g., '1h0m0s').
 */
export interface TimeoutFields {
  /**
   * The maximum duration allowed for the entire pipeline to run.
   * If the pipeline exceeds this duration, it will be terminated.
   *
   * @example
   * pipeline: '1h0m0s' // 1 hour
   */
  pipeline?: string;

  /**
   * The maximum duration allowed for each individual task in the pipeline.
   * If a task exceeds this duration, it will be terminated.
   *
   * @example
   * tasks: '30m0s' // 30 minutes
   */
  tasks?: string;

  /**
   * The maximum duration allowed for the `finally` tasks to complete.
   * `Finally` tasks run at the end of the pipeline regardless of success or failure.
   *
   * @example
   * finally: '15m0s' // 15 minutes
   */
  finally?: string;
}
