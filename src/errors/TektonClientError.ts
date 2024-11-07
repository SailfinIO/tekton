// src/errors/TektonClientError.ts

export class TektonClientError extends Error {
  public readonly method: string;
  public readonly resourceName: string;
  public readonly namespace?: string;

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
