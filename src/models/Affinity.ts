import { LabelSelector } from '../types';

/**
 * Represents affinity rules for scheduling a pod onto a node in Kubernetes.
 * Affinity rules allow specifying requirements or preferences for node and pod co-location.
 */
export interface Affinity {
  /**
   * Defines rules for scheduling a pod onto specific nodes based on node labels.
   * `nodeAffinity` enables both required and preferred node selection criteria.
   */
  nodeAffinity?: NodeAffinity;

  /**
   * Defines rules for scheduling a pod to be co-located with other specific pods.
   * `podAffinity` allows specifying requirements or preferences to locate this pod near other pods.
   */
  podAffinity?: PodAffinity;

  /**
   * Defines rules for scheduling a pod to avoid co-location with specific pods.
   * `podAntiAffinity` specifies requirements or preferences to avoid locating this pod near certain other pods.
   */
  podAntiAffinity?: PodAntiAffinity;
}

/**
 * Represents node affinity rules for selecting specific nodes to run a pod based on their labels.
 * Node affinity allows specifying hard or soft rules for node selection.
 */
export interface NodeAffinity {
  /**
   * Required node selection criteria for scheduling a pod.
   * Specifies hard constraints that a node must satisfy for the pod to be scheduled.
   */
  requiredDuringSchedulingIgnoredDuringExecution?: NodeSelector;

  /**
   * Preferred node selection criteria for scheduling a pod.
   * Specifies soft constraints that Kubernetes tries to satisfy, but does not require.
   */
  preferredDuringSchedulingIgnoredDuringExecution?: PreferredSchedulingTerm[];
}

/**
 * Represents a selector for node selection criteria based on node labels.
 * Defines one or more node selector terms that must be satisfied by a node's labels.
 */
export interface NodeSelector {
  nodeSelectorTerms: NodeSelectorTerm[];
}

/**
 * Represents a term for selecting nodes based on match expressions, using labels and operators.
 */
export interface NodeSelectorTerm {
  matchExpressions?: NodeSelectorRequirement[];
}

/**
 * Represents a requirement expression for node labels, specifying keys, operators, and values.
 */
export interface NodeSelectorRequirement {
  key: string;
  operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
  values?: string[];
}

/**
 * Represents a preferred scheduling term, specifying a weight and node selection criteria.
 * Kubernetes attempts to schedule a pod on nodes that satisfy these preferences.
 */
export interface PreferredSchedulingTerm {
  weight: number;
  preference: NodeSelectorTerm;
}

/**
 * Represents pod affinity rules for scheduling a pod near specific pods, based on labels and topology.
 */
export interface PodAffinity {
  /**
   * Required co-location criteria for scheduling a pod near specific other pods.
   * Specifies hard constraints based on labels and topology (e.g., nodes or zones).
   */
  requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];

  /**
   * Preferred co-location criteria for scheduling a pod near specific other pods.
   * Specifies soft constraints that Kubernetes tries to satisfy, based on labels and topology.
   */
  preferredDuringSchedulingIgnoredDuringExecution?: WeightedPodAffinityTerm[];
}

/**
 * Represents pod anti-affinity rules for avoiding scheduling a pod near specific pods, based on labels and topology.
 */
export interface PodAntiAffinity {
  /**
   * Required anti-co-location criteria to avoid scheduling a pod near specific other pods.
   * Specifies hard constraints based on labels and topology (e.g., nodes or zones).
   */
  requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];

  /**
   * Preferred anti-co-location criteria for avoiding scheduling a pod near specific other pods.
   * Specifies soft constraints that Kubernetes tries to satisfy, based on labels and topology.
   */
  preferredDuringSchedulingIgnoredDuringExecution?: WeightedPodAffinityTerm[];
}

/**
 * Represents a term for pod affinity or anti-affinity, defining label and topology constraints.
 */
export interface PodAffinityTerm {
  labelSelector: LabelSelector;
  topologyKey: string;
  namespaces?: string[];
}

/**
 * Represents a weighted pod affinity term, specifying a preference weight and affinity term.
 */
export interface WeightedPodAffinityTerm {
  weight: number;
  podAffinityTerm: PodAffinityTerm;
}
