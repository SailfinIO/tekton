export class ApiError extends Error {
  public statusCode: number;
  public responseBody: string;

  constructor(statusCode: number, message: string, responseBody: string) {
    super(message);
    this.name = ApiError.name;
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}
