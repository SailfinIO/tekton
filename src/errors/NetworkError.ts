/**
 * Custom error class representing a network error.
 * Extends the built-in Error class and includes the original error that caused the network failure.
 */
export class NetworkError extends Error {
  /**
   * The original error that triggered the network error, providing context for the root cause.
   */
  public originalError: Error;

  /**
   * Creates an instance of NetworkError.
   *
   * @param message - A descriptive error message indicating the nature of the network error.
   * @param originalError - The original error that caused the network failure, useful for debugging.
   *
   * @example
   * try {
   *   // code that may throw a network-related error
   * } catch (error) {
   *   throw new NetworkError('Failed to connect to the server', error);
   * }
   */
  constructor(message: string, originalError: Error) {
    super(message);
    this.name = NetworkError.name;
    this.originalError = originalError;
  }
}
