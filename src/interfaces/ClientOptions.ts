import { LogLevel } from '../enums';

/**
 * Base options for configuring clients.
 */
export interface ClientOptions {
  /**
   * The path to the Kubernetes configuration file.
   * @optional
   */
  kubeConfigPath?: string;

  /**
   * The log level to be used by the client.
   * @optional
   */
  logLevel?: LogLevel;
}

/**
 * Options for configuring the Kubernetes client.
 */
export interface KubernetesClientOptions extends ClientOptions {}

/**
 * Options for configuring the Tekton client.
 */
import { IKubernetesClient } from './IKubernetesClient';

export interface TektonClientOptions extends ClientOptions {
  /**
   * An instance of the Kubernetes client to interact with the Kubernetes API.
   * If not provided, a new Kubernetes client instance will be created.
   * @optional
   */
  k8sClient?: IKubernetesClient;
}
