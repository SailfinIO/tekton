import { TaskResult } from './TaskResult';

/**
 * Represents the status of a Tekton TaskRun, providing details about its execution state, timing, and results.
 */
export interface TaskRunStatus {
  /**
   * The status of each step in the TaskRun, including container, image, and termination details if applicable.
   */
  steps?: StepState[];

  /**
   * The timestamp when the TaskRun started, in ISO 8601 format.
   */
  startTime?: string;

  /**
   * The timestamp when the TaskRun completed, in ISO 8601 format.
   */
  completionTime?: string;

  /**
   * The name of the Kubernetes Pod in which the TaskRun is running or ran.
   * Useful for cross-referencing with Pod logs and status.
   */
  podName?: string;

  /**
   * The results produced by the TaskRun upon completion, such as output data or computed values.
   */
  taskResults?: TaskResult[];

  /**
   * The status of each retry attempt for the TaskRun, if retries were configured.
   * Contains an array of TaskRunStatus entries, one for each retry attempt.
   */
  retriesStatus?: TaskRunStatus[];
}

/**
 * Represents the state of an individual step within a TaskRun, providing container details and termination information if the step has finished.
 */
export interface StepState {
  /**
   * The name of the step, as defined in the Task specification.
   */
  name: string;

  /**
   * The name of the container executing this step, useful for debugging and log retrieval.
   */
  container: string;

  /**
   * The unique identifier for the image used in this step’s container.
   */
  imageID: string;

  /**
   * Details of the step's termination status, if the step has finished executing.
   */
  terminated?: {
    /**
     * The exit code returned by the container, where 0 indicates success and non-zero indicates failure.
     */
    exitCode: number;

    /**
     * A brief description of why the container terminated (e.g., "Completed" or "Error").
     */
    reason: string;

    /**
     * The timestamp when the step started, in ISO 8601 format.
     */
    startedAt: string;

    /**
     * The timestamp when the step finished, in ISO 8601 format.
     */
    finishedAt: string;
  };
}
