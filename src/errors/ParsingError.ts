/**
 * Custom error class representing an error that occurs during parsing.
 * Extends the built-in Error class and includes the response body that caused the parsing failure.
 */
export class ParsingError extends Error {
  /**
   * The response body that could not be parsed, providing context for the parsing error.
   */
  public responseBody: string;

  /**
   * Creates an instance of ParsingError.
   *
   * @param message - A descriptive error message indicating the parsing issue.
   * @param responseBody - The response body that failed to parse, useful for troubleshooting the error.
   *
   * @example
   * try {
   *   const data = JSON.parse(response); // may throw if response is not valid JSON
   * } catch (error) {
   *   throw new ParsingError('Failed to parse JSON response', response);
   * }
   */
  constructor(message: string, responseBody: string) {
    super(message);
    this.name = ParsingError.name;
    this.responseBody = responseBody;
  }
}
