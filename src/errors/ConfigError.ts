export class ConfigFileNotFoundError extends Error {
  constructor(path: string) {
    super(`Kubeconfig file not found at path: ${path}`);
    this.name = ConfigFileNotFoundError.name;
  }
}

export class InvalidConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = InvalidConfigError.name;
  }
}
