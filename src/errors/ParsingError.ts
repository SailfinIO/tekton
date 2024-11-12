import { YamlParserError } from './YamlParserError';

export class ParsingError extends YamlParserError {
  public responseBody: string;

  constructor(message: string, responseBody: string) {
    super(message);
    this.responseBody = responseBody;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
