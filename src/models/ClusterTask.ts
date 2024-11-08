import { KubernetesResource } from './KubernetesResource';
import { TaskSpec, TaskStatus } from './Task';

/**
 * Represents a Tekton ClusterTask resource in the Kubernetes environment.
 *
 * Extends the generic KubernetesResource interface, parameterized with `TaskSpec` and `TaskStatus` types,
 * to include specific properties and behaviors of a Tekton ClusterTask.
 *
 * A ClusterTask is a reusable, cluster-scoped Tekton task that can be referenced across multiple namespaces.
 * It defines a series of steps or actions that can be executed as part of a pipeline.
 *
 * @extends {KubernetesResource<TaskSpec, TaskStatus>}
 *
 * @example
 * const myClusterTask: ClusterTask = {
 *   apiVersion: 'tekton.dev/v1alpha1',
 *   kind: 'ClusterTask',
 *   metadata: { name: 'example-cluster-task' },
 *   spec: { 'TaskSpec properties' },
 *   status: { 'TaskStatus properties' }
 * };
 */
export interface ClusterTask extends KubernetesResource<TaskSpec, TaskStatus> {}
