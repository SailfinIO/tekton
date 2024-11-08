import { KubernetesMetadata } from './KubernetesMetadata';
import { KubernetesResource } from './KubernetesResource';
import { ParamSpec } from './ParamSpec';
import { Sidecar } from './Sidecar';
import { TaskResult } from './TaskResult';
import { Volume } from './Volume';
import { WorkspaceDeclaration } from './WorkspaceDeclaration';
import { EnvVar } from './EnvVar';
import { VolumeMount } from './VolumeMount';
import { ResourceRequirements } from './ResourceRequirements';

/**
 * Defines the specification for a Tekton Task, including its steps, parameters, workspaces, results, and sidecars.
 */
export interface TaskSpec {
  /**
   * A list of steps to execute within the task, each specifying a container image and commands.
   */
  steps: Step[];

  /**
   * A list of parameters that can be passed to the task, enabling dynamic configuration.
   */
  params?: ParamSpec[];

  /**
   * A list of workspaces required by the task, providing shared storage resources.
   */
  workspaces?: WorkspaceDeclaration[];

  /**
   * A list of results produced by the task upon completion.
   */
  results?: TaskResult[];

  /**
   * A list of sidecar containers that run alongside the task's main steps, providing auxiliary functionality.
   */
  sidecars?: Sidecar[];

  /**
   * A list of volumes available to the task's steps and sidecars.
   */
  volumes?: Volume[];
}

/**
 * Reference to a Tekton Task, either by name or as a ClusterTask.
 */
export interface TaskRef {
  /**
   * The name of the referenced task.
   */
  name: string;

  /**
   * Specifies whether the task is a namespaced Task or a Cluster-wide ClusterTask.
   */
  kind?: 'Task' | 'ClusterTask';
}

/**
 * Defines a single step within a Tekton Task, specifying a container image, commands, and environment configurations.
 */
export interface Step {
  /**
   * The name of the step, used as a unique identifier within the task.
   */
  name?: string;

  /**
   * The container image to run for this step.
   */
  image: string;

  /**
   * The shell script to execute in the step’s container, if applicable.
   */
  script?: string;

  /**
   * Arguments to pass to the step's command, appended to the command specified.
   */
  args?: string[];

  /**
   * The command to execute in the container, overriding the image’s default entrypoint.
   */
  command?: string[];

  /**
   * A list of environment variables to set in the step's container.
   */
  env?: EnvVar[];

  /**
   * A list of references to ConfigMaps or Secrets from which to import environment variables.
   */
  envFrom?: EnvFromSource[];

  /**
   * A list of volumes to mount within the container, specifying paths for each.
   */
  volumeMounts?: VolumeMount[];

  /**
   * Resource requests and limits for CPU and memory, defining the container’s resource usage.
   */
  resources?: ResourceRequirements;

  /**
   * The working directory within the container.
   */
  workingDir?: string;

  /**
   * The maximum duration this step is allowed to run, in ISO 8601 duration format (e.g., "1h", "30m").
   */
  timeout?: string;
}

/**
 * Defines the sources from which to import environment variables into a container, including ConfigMaps and Secrets.
 */
export interface EnvFromSource {
  /**
   * Reference to a ConfigMap from which to import environment variables.
   */
  configMapRef?: ConfigMapEnvSource;

  /**
   * Reference to a Secret from which to import environment variables.
   */
  secretRef?: SecretEnvSource;
}

/**
 * Represents a reference to a ConfigMap for importing environment variables.
 */
export interface ConfigMapEnvSource {
  /**
   * The name of the ConfigMap.
   */
  name: string;

  /**
   * Specifies whether the ConfigMap is optional; if true, missing ConfigMaps do not cause errors.
   */
  optional?: boolean;
}

/**
 * Represents a reference to a Secret for importing environment variables.
 */
export interface SecretEnvSource {
  /**
   * The name of the Secret.
   */
  name: string;

  /**
   * Specifies whether the Secret is optional; if true, missing Secrets do not cause errors.
   */
  optional?: boolean;
}

/**
 * Represents the current status of a Tekton Task.
 * This interface is currently empty but may be extended in the future to include additional status fields.
 */
export interface TaskStatus {}

/**
 * Represents a Tekton Task resource, defining a set of steps, parameters, workspaces, and results that form a reusable workflow unit.
 */
export class Task implements KubernetesResource {
  /**
   * The API version for the Tekton Task resource.
   */
  apiVersion: 'tekton.dev/v1beta1';

  /**
   * The kind of the Kubernetes resource, which is "Task" for this class.
   */
  kind: 'Task';

  /**
   * Metadata associated with the task, including identifiers, labels, and annotations.
   */
  metadata: KubernetesMetadata;

  /**
   * Specification of the task, defining its steps, parameters, workspaces, and other configurations.
   */
  spec: TaskSpec;

  /**
   * The current status of the task, representing its runtime state.
   */
  status?: TaskStatus;

  /**
   * Constructs a new instance of the Task class.
   * Allows for partial initialization with the `init` parameter.
   *
   * @param init - Optional initialization object to partially set up the task's properties.
   *
   * @example
   * const task = new Task({
   *   metadata: { name: 'example-task' },
   *   spec: { steps: [{ name: 'build', image: 'golang:1.15', command: ['go', 'build'] }] }
   * });
   */
  constructor(init?: Partial<Task>) {
    Object.assign(this, init);
  }
}
