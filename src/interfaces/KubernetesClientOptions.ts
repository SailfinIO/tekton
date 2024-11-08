import { LogLevel } from '../enums';

export interface KubernetesClientOptions {
  kubeConfigPath?: string;
  logLevel?: LogLevel;
}
