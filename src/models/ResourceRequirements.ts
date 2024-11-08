/**
 * Specifies the resource requirements for a Kubernetes container, including resource limits and requests.
 * Resource requirements help Kubernetes manage scheduling and ensure that containers have the necessary CPU and memory.
 */
export interface ResourceRequirements {
  /**
   * The maximum amount of resources that the container is allowed to use.
   * Each resource is specified by a name (e.g., 'cpu', 'memory') and a quantity (e.g., '1000m' for CPU, '512Mi' for memory).
   * Exceeding these limits may result in the container being throttled or terminated.
   *
   * @example
   * limits: {
   *   cpu: '1000m',
   *   memory: '512Mi'
   * }
   */
  limits?: {
    [resourceName: string]: string;
  };

  /**
   * The minimum amount of resources that the container is guaranteed to have.
   * Each resource is specified by a name (e.g., 'cpu', 'memory') and a quantity (e.g., '100m' for CPU, '256Mi' for memory).
   * Kubernetes uses these requests to schedule containers on nodes that can satisfy the minimum requirements.
   *
   * @example
   * requests: {
   *   cpu: '500m',
   *   memory: '256Mi'
   * }
   */
  requests?: {
    [resourceName: string]: string;
  };
}
