import { KubernetesResource, WatchEvent } from '../models';

/**
 * Interface for a Kubernetes client, providing methods to manage Kubernetes resources.
 */
export interface IKubernetesClient {
  /**
   * Retrieves a specific Kubernetes resource by name.
   * @template T - The type of Kubernetes resource.
   * @param apiVersion - The API version of the resource (e.g., "v1", "apps/v1").
   * @param kind - The kind of the resource (e.g., "Pod", "Deployment").
   * @param name - The name of the resource.
   * @param namespace - (Optional) The namespace of the resource.
   * @returns A promise that resolves to the requested resource.
   */
  getResource<T extends KubernetesResource>(
    apiVersion: string,
    kind: string,
    name: string,
    namespace?: string,
  ): Promise<T>;

  /**
   * Lists all resources of a specified kind within an optional namespace.
   * @template T - The type of Kubernetes resource.
   * @param apiVersion - The API version of the resources.
   * @param kind - The kind of the resources.
   * @param namespace - (Optional) The namespace to list resources in.
   * @param labelSelector - (Optional) A label selector to filter resources.
   * @param fieldSelector - (Optional) A field selector to filter resources.
   * @returns A promise that resolves to an array of resources matching the criteria.
   */
  listResources<T extends KubernetesResource>(
    apiVersion: string,
    kind: string,
    namespace?: string,
    labelSelector?: string,
    fieldSelector?: string,
  ): Promise<T[]>;

  /**
   * Creates a new Kubernetes resource within an optional namespace.
   * @template T - The type of Kubernetes resource.
   * @param resource - The resource object to create.
   * @param namespace - (Optional) The namespace where the resource will be created.
   * @returns A promise that resolves to the created resource.
   */
  createResource<T extends KubernetesResource>(
    resource: T,
    namespace?: string,
  ): Promise<T>;

  /**
   * Updates an existing Kubernetes resource within an optional namespace.
   * @template T - The type of Kubernetes resource.
   * @param resource - The updated resource object.
   * @param namespace - (Optional) The namespace of the resource.
   * @returns A promise that resolves to the updated resource.
   */
  updateResource<T extends KubernetesResource>(
    resource: T,
    namespace?: string,
  ): Promise<T>;

  /**
   * Deletes a specific Kubernetes resource by name.
   * @param apiVersion - The API version of the resource.
   * @param kind - The kind of the resource.
   * @param name - The name of the resource to delete.
   * @param namespace - (Optional) The namespace of the resource.
   * @returns A promise that resolves when the resource is deleted.
   */
  deleteResource(
    apiVersion: string,
    kind: string,
    name: string,
    namespace?: string,
  ): Promise<void>;

  /**
   * Watches a Kubernetes resource, returning an asynchronous generator of watch events.
   * @template T - The type of Kubernetes resource.
   * @param apiVersion - The API version of the resource.
   * @param kind - The kind of the resource to watch.
   * @param namespace - The namespace of the resource.
   * @param labelSelector - (Optional) A label selector to filter resources.
   * @param fieldSelector - (Optional) A field selector to filter resources.
   * @returns An asynchronous generator that yields watch events for the specified resource.
   */
  watchResource<T extends KubernetesResource>(
    apiVersion: string,
    kind: string,
    namespace: string,
    labelSelector?: string,
    fieldSelector?: string,
  ): AsyncGenerator<WatchEvent<T>>;

  /**
   * Retrieves logs from a specific pod and optional container within the pod.
   * @param podName - The name of the pod.
   * @param namespace - The namespace of the pod.
   * @param containerName - (Optional) The name of the container within the pod.
   * @returns A promise that resolves to the logs as a string.
   */
  getPodLogs(
    podName: string,
    namespace: string,
    containerName?: string,
  ): Promise<string>;
}
