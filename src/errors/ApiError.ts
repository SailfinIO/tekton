import { HttpStatus } from '../enums';

/**
 * Custom error class representing an API error, with additional details for HTTP status and response body.
 * Extends the built-in Error class to include status code and response body, providing more context for API-related errors.
 */
export class ApiError extends Error {
  /**
   * The HTTP status code associated with the API error.
   */
  public statusCode: HttpStatus;

  /**
   * The response body returned by the API, providing additional context for the error.
   */
  public responseBody: string;

  /**
   * Creates an instance of ApiError.
   *
   * @param statusCode - The HTTP status code indicating the error type (e.g., 404, 500).
   * @param message - A descriptive error message.
   * @param responseBody - The response body returned by the API, providing further details about the error.
   *
   * @example
   * try {
   *   // code that may throw an API-related error
   * } catch (error) {
   *   throw new ApiError(HttpStatus.NOT_FOUND, 'Resource not found', '{"error": "Not Found"}');
   * }
   */
  constructor(statusCode: HttpStatus, message: string, responseBody: string) {
    super(message);
    this.name = ApiError.name;
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}
