import { KubernetesMetadata } from './KubernetesMetadata';

/**
 * Represents a generic Kubernetes resource.
 * Provides a flexible structure that can be extended for various Kubernetes resource types by defining specific `spec` and `status` properties.
 *
 * @template TSpec - The type for the `spec` property, representing the desired state of the resource.
 * @template TStatus - The type for the `status` property, representing the current state of the resource.
 */
export interface KubernetesResource<TSpec = any, TStatus = any> {
  /**
   * The API version of the resource (e.g., "v1", "apps/v1").
   */
  apiVersion: string;

  /**
   * The kind of the Kubernetes resource (e.g., "Pod", "Deployment").
   */
  kind: string;

  /**
   * Metadata associated with the resource, including identifiers, labels, and annotations.
   */
  metadata: KubernetesMetadata;

  /**
   * The desired state of the resource, defined by a specification.
   * This property is typically unique to each resource type.
   */
  spec?: TSpec;

  /**
   * The current state of the resource as observed by Kubernetes.
   * This property is typically unique to each resource type.
   */
  status?: TStatus;
}
