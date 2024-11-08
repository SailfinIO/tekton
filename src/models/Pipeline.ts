import { KubernetesMetadata } from './KubernetesMetadata';
import { KubernetesResource } from './KubernetesResource';
import { ParamSpec } from './ParamSpec';
import { PipelineResult } from './PipelineResult';
import { Task } from './Task';
import { WorkspaceDeclaration } from './WorkspaceDeclaration';

/**
 * Defines the specification for a Tekton Pipeline resource.
 * Specifies the tasks, parameters, workspaces, and results that make up the pipeline.
 */
export interface PipelineSpec {
  /**
   * A list of tasks to be executed as part of the pipeline.
   */
  tasks: Task[];

  /**
   * An optional list of parameter specifications that define configurable parameters for the pipeline.
   */
  params?: ParamSpec[];

  /**
   * An optional list of workspaces that the pipeline expects to be provided at runtime.
   */
  workspaces?: WorkspaceDeclaration[];

  /**
   * An optional list of results that the pipeline produces upon completion.
   */
  results?: PipelineResult[];

  /**
   * An optional list of tasks to be executed in a "finally" block, which always runs at the end of the pipeline, regardless of success or failure of other tasks.
   */
  finally?: Task[];
}

/**
 * Represents the status of a Tekton Pipeline.
 * This interface is currently empty but may include additional fields in future implementations to represent the pipeline's runtime status.
 */
export interface PipelineStatus {}

/**
 * Represents a Tekton Pipeline resource.
 * Extends the generic KubernetesResource with `PipelineSpec` and `PipelineStatus` to provide details specific to a Tekton pipeline.
 */
export class Pipeline
  implements KubernetesResource<PipelineSpec, PipelineStatus>
{
  /**
   * The API version for the Tekton Pipeline resource.
   */
  apiVersion: 'tekton.dev/v1beta1';

  /**
   * The kind of the Kubernetes resource, which is "Pipeline" for this class.
   */
  kind: 'Pipeline';

  /**
   * Metadata associated with the pipeline, including identifiers, labels, and annotations.
   */
  metadata: KubernetesMetadata;

  /**
   * Specification of the pipeline, defining its tasks, parameters, workspaces, and results.
   */
  spec: PipelineSpec;

  /**
   * The current status of the pipeline, representing its runtime state.
   */
  status?: PipelineStatus;

  /**
   * Constructs a new instance of the Pipeline class.
   * Allows for partial initialization with the `init` parameter.
   *
   * @param init - Optional initialization object to partially set up the pipeline's properties.
   *
   * @example
   * const pipeline = new Pipeline({
   *   metadata: { name: 'example-pipeline' },
   *   spec: { tasks: [], params: [], workspaces: [] }
   * });
   */
  constructor(init?: Partial<Pipeline>) {
    Object.assign(this, init);
  }
}
