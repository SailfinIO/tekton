import { PipelineSpec } from './Pipeline';
import { PipelineResult } from './PipelineResult';
import { TaskRunStatus } from './TaskRunStatus';

/**
 * Enum representing possible statuses for a PipelineRun.
 */
export enum PipelineRunStatusEnum {
  /**
   * Indicates that the PipelineRun has been cancelled.
   */
  Cancelled = 'PipelineRunCancelled',

  /**
   * Indicates that the PipelineRun is pending and has not started yet.
   */
  Pending = 'PipelineRunPending',

  /**
   * Indicates that the PipelineRun was stopped intentionally.
   */
  Stopped = 'PipelineRunStopped',
}

/**
 * Represents the status of a Tekton PipelineRun, including start and completion times, results, and the status of individual TaskRuns.
 */
export interface PipelineRunStatus {
  /**
   * The time when the PipelineRun started, in ISO 8601 format.
   */
  startTime?: string;

  /**
   * The time when the PipelineRun completed, in ISO 8601 format.
   */
  completionTime?: string;

  /**
   * The specification of the Pipeline being executed by this PipelineRun.
   * This may be included as a snapshot to represent the Pipeline at the time of execution.
   */
  pipelineSpec?: PipelineSpec;

  /**
   * The results produced by the PipelineRun upon completion.
   */
  pipelineResults?: PipelineResult[];

  /**
   * A mapping of TaskRun names to their statuses, showing the state of each task within the PipelineRun.
   */
  taskRuns?: { [taskRunName: string]: TaskRunStatus };

  /**
   * References to child resources created by the PipelineRun, such as TaskRuns or custom Runs.
   */
  childReferences?: ChildStatusReference[];

  /**
   * A list of tasks that were skipped during execution, with reasons for skipping each task.
   */
  skippedTasks?: SkippedTask[];
}

/**
 * Represents a reference to a child status in a PipelineRun.
 * This includes tasks or custom resources managed within the PipelineRun.
 */
export interface ChildStatusReference {
  /**
   * The type of the child resource, such as 'TaskRun' or 'Run'.
   */
  type: string;

  /**
   * The name of the child resource.
   */
  name: string;

  /**
   * The name of the Pipeline task associated with this child resource.
   */
  pipelineTaskName: string;
}

/**
 * Represents a task that was skipped during a PipelineRun.
 * Provides the name of the skipped task and a reason for why it was skipped.
 */
export interface SkippedTask {
  /**
   * The name of the task that was skipped.
   */
  name: string;

  /**
   * The reason the task was skipped.
   */
  reason: string;
}
