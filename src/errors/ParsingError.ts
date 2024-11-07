export class ParsingError extends Error {
  constructor(
    message: string,
    public responseBody: string,
  ) {
    super(message);
    this.name = ParsingError.name;
  }
}
