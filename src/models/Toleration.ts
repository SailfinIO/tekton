/**
 * Represents a toleration for Kubernetes node taints, allowing the pod to schedule on nodes with matching taints.
 * Tolerations control how a pod responds to node taints, influencing where it can be scheduled or executed.
 */
export interface Toleration {
  /**
   * The key of the taint to tolerate.
   * If not specified, this toleration matches all taints with the specified `effect`.
   */
  key?: string;

  /**
   * The operator to use for matching the taint's `key` and `value`.
   * - `'Exists'` matches if the taint `key` exists, ignoring `value`.
   * - `'Equal'` matches if both the taint `key` and `value` are equal to this toleration's `key` and `value`.
   *
   * @default 'Equal'
   */
  operator?: 'Exists' | 'Equal';

  /**
   * The value to match for the specified `key` when `operator` is set to `'Equal'`.
   */
  value?: string;

  /**
   * The effect of the taint to tolerate, which determines the scheduling or execution behavior:
   * - `'NoSchedule'` prevents scheduling on nodes with this taint unless tolerated.
   * - `'PreferNoSchedule'` avoids scheduling on nodes with this taint but allows it if no other options are available.
   * - `'NoExecute'` evicts running pods if they do not tolerate the taint.
   */
  effect?: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';

  /**
   * The duration (in seconds) for which the pod tolerates the taint when `effect` is set to `'NoExecute'`.
   * If specified, the pod can remain on the tainted node for this duration before eviction.
   *
   * @example
   * tolerationSeconds: 3600 // 1 hour
   */
  tolerationSeconds?: number;
}
