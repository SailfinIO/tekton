import { LogLevel } from '../enums';
import { IKubernetesClient } from './IKubernetesClient';

/**
 * Options for configuring the Tekton client.
 */
export interface TektonClientOptions {
  /**
   * The path to the Kubernetes configuration file.
   * @optional
   */
  kubeConfigPath?: string;

  /**
   * The log level to be used by the Tekton client.
   * Determines the verbosity of logs.
   * @optional
   */
  logLevel?: LogLevel;

  /**
   * An instance of the Kubernetes client to interact with the Kubernetes API.
   * If not provided, a new Kubernetes client instance will be created.
   * @optional
   */
  k8sClient?: IKubernetesClient;
}
