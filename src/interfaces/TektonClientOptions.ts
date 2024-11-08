import { LogLevel } from '../enums';
import { IKubernetesClient } from './IKubernetesClient';

export interface TektonClientOptions {
  kubeConfigPath?: string;
  logLevel?: LogLevel;
  k8sClient?: IKubernetesClient;
}
