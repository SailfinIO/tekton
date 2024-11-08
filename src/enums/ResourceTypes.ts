/**
 * Enum representing the types of resources managed by the client.
 * Used to specify the kind of resource being interacted with.
 *
 * @enum {string}
 * @readonly
 */
export enum ResourceType {
  /**
   * Represents a Tekton pipeline resource, typically used for defining a series of tasks.
   */
  Pipeline = 'Pipeline',

  /**
   * Represents a Tekton task resource, used to define a single executable step within a pipeline.
   */
  Task = 'Task',

  /**
   * Represents a job resource, used to define and execute batch processing tasks.
   */
  Job = 'Job',
}
