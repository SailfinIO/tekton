/**
 * Binds a workspace to a pipeline task in Tekton, allowing the task to access shared storage.
 * `WorkspacePipelineTaskBinding` specifies the workspace name, its reference, and an optional sub-path within the workspace.
 */
export interface WorkspacePipelineTaskBinding {
  /**
   * The name of the workspace as defined in the task, used to match this binding to the task’s workspace requirement.
   */
  name: string;

  /**
   * The name of the workspace to bind, corresponding to a declared workspace in the pipeline.
   * This connects the task’s workspace to a specific workspace instance in the pipeline.
   */
  workspace: string;

  /**
   * An optional sub-path within the workspace to mount for this task.
   * Allows mounting a specific directory or file within the workspace, rather than the entire workspace.
   *
   * @example
   * subPath: 'data/logs'
   */
  subPath?: string;
}
