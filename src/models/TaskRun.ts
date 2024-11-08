import { KubernetesResource } from './KubernetesResource';
import { TaskRunSpec } from './TaskRunSpec';
import { TaskRunStatus } from './TaskRunStatus';

/**
 * Represents a Tekton TaskRun resource, which defines the execution of a Task.
 * Extends the generic KubernetesResource interface with `TaskRunSpec` for the desired state and `TaskRunStatus` for the observed state.
 * A `TaskRun` provides the configuration, runtime status, and results for a single execution of a task within a Tekton pipeline.
 */
export interface TaskRun
  extends KubernetesResource<TaskRunSpec, TaskRunStatus> {}
