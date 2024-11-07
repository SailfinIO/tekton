export class NetworkError extends Error {
  constructor(
    message: string,
    public originalError: Error,
  ) {
    super(message);
    this.name = NetworkError.name;
  }
}
