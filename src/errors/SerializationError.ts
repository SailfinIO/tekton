import { YAMLValue } from '../types';
import { YamlParserError } from './YamlParserError';

export class SerializationError extends YamlParserError {
  public data: any;

  constructor(message: string, data: any) {
    super(message);
    this.data = data;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
