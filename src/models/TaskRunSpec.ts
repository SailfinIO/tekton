import { Param } from './Param';
import { PodTemplate } from './PodTemplate';
import { TaskSpec } from './Task';
import { WorkspaceBinding } from './WorkspaceBinding';

/**
 * Defines the specification for a Tekton TaskRun, configuring how a Task should be executed.
 * A `TaskRunSpec` allows specifying the task to run, parameters, workspaces, timeouts, and other execution settings.
 */
export interface TaskRunSpec {
  /**
   * Reference to a Tekton Task by name, specifying the task to execute.
   * Allows using either a namespaced Task or a Cluster-wide ClusterTask.
   */
  taskRef?: {
    /**
     * The name of the referenced Task or ClusterTask.
     */
    name: string;

    /**
     * Specifies whether the referenced task is a namespaced Task or a ClusterTask.
     */
    kind?: 'Task' | 'ClusterTask';
  };

  /**
   * An inline specification of a Task to execute if no `taskRef` is provided.
   * This allows defining a custom Task directly within the TaskRun.
   */
  taskSpec?: TaskSpec;

  /**
   * A list of parameters to pass to the Task during execution, overriding any default values defined in the Task.
   */
  params?: Param[];

  /**
   * The name of the service account to use for running the TaskRun.
   * @deprecated Use `podTemplate` for more granular control over Pod configurations.
   */
  serviceAccountName?: string;

  /**
   * A template for configuring the Pod in which the TaskRun will execute.
   * Allows customization of settings such as node selectors, tolerations, and affinity.
   */
  podTemplate?: PodTemplate;

  /**
   * A list of workspace bindings that provide shared storage resources to the TaskRun.
   * These workspaces match the Task’s declared workspaces and specify where to mount storage volumes.
   */
  workspaces?: WorkspaceBinding[];

  /**
   * Specifies timeouts for different phases of the TaskRun.
   * Allows setting a maximum duration for task start and completion phases.
   */
  timeouts?: {
    /**
     * The maximum duration allowed for the TaskRun to start, in ISO 8601 format (e.g., "30m").
     */
    start?: string;

    /**
     * The maximum duration allowed for the TaskRun to complete, in ISO 8601 format (e.g., "1h").
     */
    completion?: string;
  };
}
