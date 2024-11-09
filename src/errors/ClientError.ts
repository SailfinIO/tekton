/**
 * Custom error class representing an error encountered when interacting with the Tekton/Kubernetes client.
 * Extends the built-in Error class and includes additional details about the method and resource involved.
 */
export class ClientError extends Error {
  /**
   * The name of the method in the Tekton/Kubernetes client where the error occurred.
   */
  public readonly method: string;

  /**
   * The name of the Tekton/Kubernetes resource related to the error (e.g., Pipeline, Task).
   */
  public readonly resourceName: string;

  /**
   * The namespace in which the Tekton/Kubernetes resource exists, if applicable.
   */
  public readonly namespace?: string;

  /**
   * Creates an instance of ClientError.
   *
   * @param message - A descriptive error message explaining the issue.
   * @param method - The name of the Tekton/Kubernetes client method that caused the error.
   * @param resourceName - The name of the Tekton/Kubernetes resource involved in the error.
   * @param namespace - (Optional) The namespace in which the resource resides.
   *
   * @example
   * try {
   *   // code interacting with Tekton/Kubernetes client
   * } catch (error) {
   *   throw new ClientError('Failed to retrieve pipeline', 'getPipeline', 'example-pipeline', 'default');
   * }
   */
  constructor(
    message: string,
    method: string,
    resourceName: string,
    namespace?: string,
  ) {
    super(message);
    this.name = ClientError.name;
    this.method = method;
    this.resourceName = resourceName;
    this.namespace = namespace;
  }
}
