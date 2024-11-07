// src/models/KubernetesResource.ts

import { KubernetesMetadata } from './KubernetesMetadata';

export interface KubernetesResource<TSpec = any, TStatus = any> {
  apiVersion: string;
  kind: string;
  metadata: KubernetesMetadata;
  spec?: TSpec;
  status?: TStatus;
}
