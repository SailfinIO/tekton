/**
 * Represents an event in a Kubernetes watch stream, providing information about changes to a resource.
 * The `WatchEvent` type is used to monitor the lifecycle of Kubernetes resources, capturing additions, modifications, deletions, and errors.
 */
export interface WatchEvent<T> {
  /**
   * The type of the event, indicating the change that occurred to the resource.
   * - `'ADDED'`: The resource was newly created.
   * - `'MODIFIED'`: The resource was updated.
   * - `'DELETED'`: The resource was removed.
   * - `'ERROR'`: An error occurred while watching the resource.
   */
  type: 'ADDED' | 'MODIFIED' | 'DELETED' | 'ERROR';

  /**
   * The resource object associated with the event.
   * This contains the full resource data as it exists following the event type (e.g., after addition or modification).
   */
  object: T;
}
