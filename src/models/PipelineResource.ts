import { KubernetesResource } from './KubernetesResource';
import { KubernetesMetadata } from './KubernetesMetadata';
import { PipelineResourceSpec } from './PipelineResourceSpec';

/**
 * Represents the status of a Tekton PipelineResource.
 * This interface is currently empty but may include additional fields in future implementations to represent the runtime status of the pipeline resource.
 */
export interface PipelineResourceStatus {}

/**
 * Represents a Tekton PipelineResource.
 * Extends the generic KubernetesResource with `PipelineResourceSpec` and `PipelineResourceStatus` to provide specifics for a Tekton pipeline resource.
 * A PipelineResource is typically used to define external resources such as Git repositories, images, or storage locations that are inputs or outputs in a pipeline.
 */
export class PipelineResource
  implements KubernetesResource<PipelineResourceSpec, PipelineResourceStatus>
{
  /**
   * The API version of the PipelineResource.
   */
  apiVersion: 'tekton.dev/v1alpha1' = 'tekton.dev/v1alpha1';

  /**
   * The kind of the Kubernetes resource, which is "PipelineResource" for this class.
   */
  kind: 'PipelineResource' = 'PipelineResource';

  /**
   * Metadata associated with the pipeline resource, including identifiers, labels, and annotations.
   */
  metadata: KubernetesMetadata;

  /**
   * Specification of the pipeline resource, defining its type and configuration details.
   */
  spec: PipelineResourceSpec;

  /**
   * The current status of the pipeline resource, representing its runtime state.
   */
  status?: PipelineResourceStatus;

  /**
   * Constructs a new instance of the PipelineResource class.
   * Allows for partial initialization with the `init` parameter.
   *
   * @param init - Optional initialization object to partially set up the pipeline resource's properties.
   *
   * @example
   * const pipelineResource = new PipelineResource({
   *   metadata: { name: 'example-resource' },
   *   spec: { type: 'git', params: [{ name: 'url', value: 'https://github.com/example/repo.git' }] }
   * });
   */
  constructor(init?: Partial<PipelineResource>) {
    Object.assign(this, init);
  }
}
