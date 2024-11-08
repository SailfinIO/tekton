/**
 * Represents an environment variable for a Kubernetes container.
 * Defines the name and value of the environment variable, with options to reference values from secrets or config maps.
 */
export interface EnvVar {
  /**
   * The name of the environment variable.
   */
  name: string;

  /**
   * The literal value of the environment variable.
   * If provided, this value will be set directly.
   */
  value?: string;

  /**
   * References to an external source (secret or config map) to populate the environment variable's value.
   * If `valueFrom` is provided, it takes precedence over `value`.
   */
  valueFrom?: EnvVarSource;
}

/**
 * Represents a source for setting an environment variable's value from a Kubernetes secret or config map.
 */
export interface EnvVarSource {
  /**
   * Reference to a key within a Kubernetes secret to populate the environment variable's value.
   */
  secretKeyRef?: SecretKeySelector;

  /**
   * Reference to a key within a Kubernetes config map to populate the environment variable's value.
   */
  configMapKeyRef?: ConfigMapKeySelector;
}

/**
 * Represents a reference to a specific key within a Kubernetes secret.
 * Used to populate the value of an environment variable from a Kubernetes secret.
 */
export interface SecretKeySelector {
  /**
   * The name of the Kubernetes secret.
   */
  name: string;

  /**
   * The specific key within the secret to use for the environment variable's value.
   */
  key: string;

  /**
   * Specifies whether the environment variable is optional.
   * If true, the environment variable will not be set if the key is missing from the secret.
   */
  optional?: boolean;
}

/**
 * Represents a reference to a specific key within a Kubernetes config map.
 * Used to populate the value of an environment variable from a Kubernetes config map.
 */
export interface ConfigMapKeySelector {
  /**
   * The name of the Kubernetes config map.
   */
  name: string;

  /**
   * The specific key within the config map to use for the environment variable's value.
   */
  key: string;

  /**
   * Specifies whether the environment variable is optional.
   * If true, the environment variable will not be set if the key is missing from the config map.
   */
  optional?: boolean;
}
