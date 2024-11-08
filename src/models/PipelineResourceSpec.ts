/**
 * Represents the specification of a Tekton PipelineResource.
 * Defines the type of resource and any associated parameters required for the resource configuration.
 */
export interface PipelineResourceSpec {
  /**
   * The type of the resource (e.g., "git", "storage", "image").
   * This determines how the resource will be used in the pipeline.
   */
  type: string;

  /**
   * An optional list of resource parameters that define the configuration details for the resource.
   * These parameters can be used to specify details such as URLs or paths specific to the resource.
   */
  params?: ResourceParam[];

  /**
   * An optional list of secret parameters to provide sensitive information needed for resource access.
   * Secrets are typically used for credentials or tokens required by the resource.
   */
  secrets?: SecretParam[];
}

/**
 * Represents a resource parameter used in a PipelineResource.
 * Defines a key-value pair for configuring the resource.
 */
export interface ResourceParam {
  /**
   * The name of the parameter.
   */
  name: string;

  /**
   * The value of the parameter, which can be a URL, path, or any other required detail for the resource.
   */
  value: string;
}

/**
 * Represents a secret parameter used in a PipelineResource.
 * Provides a reference to a Kubernetes secret that contains sensitive information.
 */
export interface SecretParam {
  /**
   * The name of the field within the secret that holds the value.
   */
  fieldName: string;

  /**
   * The key of the secret that contains the value needed for the resource.
   */
  secretKey: string;

  /**
   * The name of the Kubernetes secret that holds the credentials or sensitive information.
   */
  secretName: string;
}
