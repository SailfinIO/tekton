/**
 * Declares a workspace in Tekton, specifying how it should be mounted and accessed within a task or pipeline.
 * `WorkspaceDeclaration` provides configuration for mounting a shared storage resource at a specified path.
 */
export interface WorkspaceDeclaration {
  /**
   * The name of the workspace, used to reference it within the task or pipeline.
   */
  name: string;

  /**
   * An optional sub-path within the workspace to mount.
   * This allows mounting only a specific directory or file within the workspace, rather than the entire workspace.
   *
   * @example
   * subPath: 'data/config'
   */
  subPath?: string;

  /**
   * The path within the container where the workspace will be mounted.
   * Files from the workspace will be accessible at this path in the container’s filesystem.
   *
   * @example
   * mountPath: '/workspace/data'
   */
  mountPath: string;
}
