import { Param } from './Param';
import { TaskRef, TaskSpec } from './Task';
import { WhenExpression } from './WhenExpression';
import { WorkspacePipelineTaskBinding } from './WorkspacePipelineTaskBinding';

/**
 * Represents a task within a Tekton Pipeline, defining how and when the task should execute within the pipeline.
 * A `PipelineTask` can reference a predefined task or define its own task specification, and it may have dependencies on other tasks.
 */
export interface PipelineTask {
  /**
   * The name of the pipeline task, used as a unique identifier within the pipeline.
   */
  name: string;

  /**
   * A reference to a predefined Tekton Task by name.
   * This is used when an existing Task is being utilized within the pipeline.
   */
  taskRef?: TaskRef;

  /**
   * An inline specification of the task to be executed if `taskRef` is not provided.
   * This allows defining custom tasks directly within the pipeline.
   */
  taskSpec?: TaskSpec;

  /**
   * A list of parameters to pass to the task at runtime, overriding any default values specified in the task definition.
   */
  params?: Param[];

  /**
   * A list of task names that this task should run after, establishing dependencies within the pipeline.
   */
  runAfter?: string[];

  /**
   * A list of when expressions that control the conditional execution of this task.
   * When expressions are evaluated before running the task and determine if the task should execute.
   */
  when?: WhenExpression[];

  /**
   * A list of workspace bindings to be provided to this task, matching workspaces declared in the task definition.
   * These bindings specify resources, such as storage, needed for task execution.
   */
  workspaces?: WorkspacePipelineTaskBinding[];

  /**
   * The number of times to retry the task if it fails.
   */
  retries?: number;
}
