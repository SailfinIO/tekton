// src/interfaces/IKubernetesClient.ts

import { KubernetesResource, WatchEvent } from '../models';

export interface IKubernetesClient {
  getResource<T extends KubernetesResource>(
    apiVersion: string,
    kind: string,
    name: string,
    namespace?: string,
  ): Promise<T>;

  listResources<T extends KubernetesResource>(
    apiVersion: string,
    kind: string,
    namespace?: string,
    labelSelector?: string,
    fieldSelector?: string,
  ): Promise<T[]>;

  createResource<T extends KubernetesResource>(
    resource: T,
    namespace?: string,
  ): Promise<T>;

  updateResource<T extends KubernetesResource>(
    resource: T,
    namespace?: string,
  ): Promise<T>;

  deleteResource(
    apiVersion: string,
    kind: string,
    name: string,
    namespace?: string,
  ): Promise<void>;

  watchResource<T extends KubernetesResource>(
    apiVersion: string,
    kind: string,
    namespace: string,
    labelSelector?: string,
    fieldSelector?: string,
  ): AsyncGenerator<WatchEvent<T>>;

  getPodLogs(
    podName: string,
    namespace: string,
    containerName?: string,
  ): Promise<string>;
}
