import { Toleration } from './Toleration';
import { Affinity } from './Affinity';
import { SecurityContext } from './SecurityContext';
import { Volume } from './Volume';
import { LabelSelector } from '../types';

/**
 * Represents a template for configuring the Pod in which a Tekton task or pipeline will run.
 * Allows customization of the pod's scheduling, security, storage, and networking settings.
 */
export interface PodTemplate {
  /**
   * A set of key-value pairs to specify node selection criteria.
   * Determines the nodes on which the pod can be scheduled by matching node labels.
   */
  nodeSelector?: LabelSelector;

  /**
   * A list of tolerations that allow (but do not require) the pod to be scheduled on nodes with matching taints.
   * Useful for controlling pod placement on nodes with specific configurations.
   */
  tolerations?: Toleration[];

  /**
   * Specifies scheduling preferences and constraints to control pod placement.
   * Defines rules such as affinity or anti-affinity to guide which nodes the pod should or should not be scheduled on.
   */
  affinity?: Affinity;

  /**
   * Defines security options for the pod, such as running as a specific user or limiting access permissions.
   * Configures security policies for the container runtime environment.
   */
  securityContext?: SecurityContext;

  /**
   * A list of volumes to attach to the pod, making storage resources available to containers.
   */
  volumes?: Volume[];

  /**
   * Specifies the DNS policy for the pod.
   * Common values include "ClusterFirst" (default) or "Default" for inheriting node DNS settings.
   */
  dnsPolicy?: string;

  /**
   * Indicates whether the pod should automatically mount the service account token.
   * If set to `false`, prevents the pod from mounting the token by default.
   */
  automountServiceAccountToken?: boolean;

  /**
   * Determines whether environment variables referencing service names should be injected into the pod.
   * If set to `false`, disables the automatic creation of service links.
   */
  enableServiceLinks?: boolean;
}
