/**
 * Custom error class representing an error encountered when interacting with the Tekton client.
 * Extends the built-in Error class and includes additional details about the method and resource involved.
 */
export class TektonClientError extends Error {
  /**
   * The name of the method in the Tekton client where the error occurred.
   */
  public readonly method: string;

  /**
   * The name of the Tekton resource related to the error (e.g., Pipeline, Task).
   */
  public readonly resourceName: string;

  /**
   * The namespace in which the Tekton resource exists, if applicable.
   */
  public readonly namespace?: string;

  /**
   * Creates an instance of TektonClientError.
   *
   * @param message - A descriptive error message explaining the issue.
   * @param method - The name of the Tekton client method that caused the error.
   * @param resourceName - The name of the Tekton resource involved in the error.
   * @param namespace - (Optional) The namespace in which the resource resides.
   *
   * @example
   * try {
   *   // code interacting with Tekton client
   * } catch (error) {
   *   throw new TektonClientError('Failed to retrieve pipeline', 'getPipeline', 'example-pipeline', 'default');
   * }
   */
  constructor(
    message: string,
    method: string,
    resourceName: string,
    namespace?: string,
  ) {
    super(message);
    this.name = TektonClientError.name;
    this.method = method;
    this.resourceName = resourceName;
    this.namespace = namespace;
  }
}
