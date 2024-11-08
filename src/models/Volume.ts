/**
 * Represents a storage volume in a Kubernetes Pod, which can be an empty directory, ConfigMap, or Secret.
 * Volumes provide storage to containers in a pod and can be used for various purposes, such as configuration, secrets, or temporary storage.
 */
export interface Volume {
  /**
   * The name of the volume, used to reference it within containers.
   */
  name: string;

  /**
   * An empty directory volume that is created when a pod is assigned to a node and exists as long as the pod runs on that node.
   * Often used for temporary storage that does not need to persist beyond the pod’s lifecycle.
   */
  emptyDir?: {};

  /**
   * A volume populated with data from a Kubernetes ConfigMap.
   * Used to expose configuration data to containers within the pod.
   */
  configMap?: ConfigMapVolumeSource;

  /**
   * A volume populated with data from a Kubernetes Secret.
   * Used to expose sensitive information, such as passwords or tokens, to containers within the pod.
   */
  secret?: SecretVolumeSource;
}

/**
 * Represents a volume sourced from a ConfigMap in Kubernetes.
 * The ConfigMapVolumeSource allows specific keys from the ConfigMap to be mapped to paths within the volume.
 */
export interface ConfigMapVolumeSource {
  /**
   * The name of the ConfigMap to populate the volume with.
   */
  name: string;

  /**
   * Optional list of mappings between ConfigMap keys and paths within the volume.
   * This allows selective mapping of specific keys to specific file paths.
   */
  items?: KeyToPath[];
}

/**
 * Represents a volume sourced from a Secret in Kubernetes.
 * The SecretVolumeSource allows specific keys from the Secret to be mapped to paths within the volume.
 */
export interface SecretVolumeSource {
  /**
   * The name of the Secret to populate the volume with.
   */
  secretName: string;

  /**
   * Optional list of mappings between Secret keys and paths within the volume.
   * This allows selective mapping of specific keys to specific file paths.
   */
  items?: KeyToPath[];
}

/**
 * Represents a mapping of a key to a path within a volume.
 * Allows specific data items in a ConfigMap or Secret to be mapped to designated paths within the volume.
 */
export interface KeyToPath {
  /**
   * The key in the ConfigMap or Secret to map.
   */
  key: string;

  /**
   * The path within the volume where the key’s value should be stored.
   */
  path: string;
}
