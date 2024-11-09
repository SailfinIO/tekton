export class KubeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = KubeConfigError.name;
  }
}

export class ConfigFileNotFoundError extends KubeConfigError {
  constructor(path: string) {
    super(`Kubeconfig file not found at path: ${path}`);
    this.name = ConfigFileNotFoundError.name;
  }
}

export class InvalidConfigError extends KubeConfigError {
  constructor(message: string) {
    super(message);
    this.name = InvalidConfigError.name;
  }
}

export class NotInClusterError extends KubeConfigError {
  constructor(message: string) {
    super(message);
    this.name = NotInClusterError.name;
  }
}

export class ParsingError extends KubeConfigError {
  public responseBody: string;

  constructor(message: string, responseBody: string) {
    super(message);
    this.name = ParsingError.name;
    this.responseBody = responseBody;
  }
}
