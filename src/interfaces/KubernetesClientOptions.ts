import { LogLevel } from '../enums';

/**
 * Options for configuring the Kubernetes client.
 */
export interface KubernetesClientOptions {
  /**
   * The path to the Kubernetes configuration file.
   * @optional
   */
  kubeConfigPath?: string;

  /**
   * The log level to be used by the Kubernetes client.
   * @optional
   */
  logLevel?: LogLevel;
}
