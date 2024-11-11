export class ExecAuthError extends Error {
  /**
   * Creates an instance of ExecAuthError.
   *
   * @param message - A descriptive error message indicating the nature of the exec auth error.
   *
   * @example
   * try {
   *   // code that may throw an exec auth-related error
   * } catch (error) {
   *   throw new ExecAuthError('Failed to authenticate using exec plugin');
   * }
   */
  constructor(message: string) {
    super(message);
    this.name = ExecAuthError.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
