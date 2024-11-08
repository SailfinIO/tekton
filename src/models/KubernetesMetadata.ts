import { LabelSelector } from '../types';

/**
 * Represents metadata associated with a Kubernetes resource.
 * Contains identifying information, labels, annotations, and other details about the resource.
 */
export interface KubernetesMetadata {
  /**
   * The name of the Kubernetes resource.
   */
  name: string;

  /**
   * The namespace in which the resource resides. Optional for cluster-scoped resources.
   */
  namespace?: string;

  /**
   * Key-value pairs used to organize and select resources.
   */
  labels?: LabelSelector;

  /**
   * Key-value pairs used to store arbitrary metadata about the resource.
   */
  annotations?: LabelSelector;

  /**
   * A unique identifier assigned to the resource by Kubernetes.
   */
  uid?: string;

  /**
   * The version of the resource, updated by Kubernetes with each change.
   */
  resourceVersion?: string;

  /**
   * A number representing the generation of the resource, used to track updates.
   */
  generation?: number;

  /**
   * The timestamp indicating when the resource was created.
   */
  creationTimestamp?: string;

  /**
   * The timestamp indicating when the resource was marked for deletion, if applicable.
   */
  deletionTimestamp?: string;

  /**
   * A list of owner references that specify other resources responsible for managing this resource.
   */
  ownerReferences?: OwnerReference[];

  /**
   * Additional metadata fields as key-value pairs, allowing for extended properties.
   */
  [key: string]: any;
}

/**
 * Represents a reference to an owner resource in Kubernetes.
 * Used to indicate that one resource is controlled by or dependent on another resource.
 */
export interface OwnerReference {
  /**
   * The API version of the owner resource (e.g., "v1", "apps/v1").
   */
  apiVersion: string;

  /**
   * The kind of the owner resource (e.g., "Deployment", "ReplicaSet").
   */
  kind: string;

  /**
   * The name of the owner resource.
   */
  name: string;

  /**
   * The unique identifier of the owner resource.
   */
  uid: string;

  /**
   * Specifies if the owner resource actively manages this resource.
   */
  controller?: boolean;

  /**
   * If true, blocks deletion of the owner resource until this resource is deleted.
   */
  blockOwnerDeletion?: boolean;
}
