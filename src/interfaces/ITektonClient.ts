import {
  ClusterTask,
  Pipeline,
  PipelineResource,
  PipelineRun,
  PipelineRunStatus,
  Task,
  TaskRun,
  WatchEvent,
  TaskRunStatus,
} from '../models';

/**
 * Options for retrieving a single resource.
 */
export interface GetOptions {
  /** The namespace of the resource. */
  namespace: string;

  /** The label selector to filter resources. */
  labelSelector?: string;

  /** The field selector to filter resources. */
  fieldSelector?: string;
}

/**
 * Options for listing resources.
 */
export interface ListOptions {
  /** The namespace of the resources. */
  namespace?: string;

  /** The label selector to filter resources. */
  labelSelector?: string;

  /** The field selector to filter resources. */
  fieldSelector?: string;
}

/**
 * Interface for a client to interact with the Tekton API.
 */
export interface ITektonClient {
  // Pipeline Operations

  /**
   * Retrieves a pipeline by name.
   * @param name - The name of the pipeline.
   * @param options - Options for retrieving the pipeline.
   * @returns A promise that resolves to the requested Pipeline.
   */
  getPipeline(name: string, options: GetOptions): Promise<Pipeline>;

  /**
   * Lists all pipelines based on the provided options.
   * @param options - Options for listing pipelines.
   * @returns A promise that resolves to an array of Pipelines.
   */
  listPipelines(options: ListOptions): Promise<Pipeline[]>;

  /**
   * Creates a new pipeline in the specified namespace.
   * @param pipeline - The Pipeline object to create.
   * @param namespace - The namespace where the pipeline will be created.
   * @returns A promise that resolves to the created Pipeline.
   */
  createPipeline(pipeline: Pipeline, namespace: string): Promise<Pipeline>;

  /**
   * Updates an existing pipeline in the specified namespace.
   * @param pipeline - The Pipeline object with updated data.
   * @param namespace - The namespace of the pipeline.
   * @returns A promise that resolves to the updated Pipeline.
   */
  updatePipeline(pipeline: Pipeline, namespace: string): Promise<Pipeline>;

  /**
   * Deletes a pipeline by name from the specified namespace.
   * @param name - The name of the pipeline to delete.
   * @param namespace - The namespace of the pipeline.
   * @returns A promise that resolves when the pipeline is deleted.
   */
  deletePipeline(name: string, namespace: string): Promise<void>;

  // PipelineRun Operations

  /**
   * Retrieves a pipeline run by name.
   * @param name - The name of the pipeline run.
   * @param namespace - The namespace of the pipeline run.
   * @returns A promise that resolves to the requested PipelineRun.
   */
  getPipelineRun(name: string, namespace: string): Promise<PipelineRun>;

  /**
   * Retrieves the status of a pipeline run by name.
   * @param name - The name of the pipeline run.
   * @param namespace - The namespace of the pipeline run.
   * @returns {PipelineRunStatus} A promise that resolves to the status of the requested PipelineRun.
   */
  getPipelineRunStatus(
    name: string,
    namespace: string,
  ): Promise<PipelineRunStatus>;

  /**
   * Lists all pipeline runs in the specified namespace.
   * @param namespace - The namespace to list pipeline runs from.
   * @returns A promise that resolves to an array of PipelineRuns.
   */
  listPipelineRuns(namespace: string): Promise<PipelineRun[]>;

  /**
   * Creates a new pipeline run in the specified namespace.
   * @param pipelineRun - The PipelineRun object to create.
   * @param namespace - The namespace where the pipeline run will be created.
   * @returns A promise that resolves to the created PipelineRun.
   */
  createPipelineRun(
    pipelineRun: PipelineRun,
    namespace: string,
  ): Promise<PipelineRun>;

  /**
   * Deletes a pipeline run by name from the specified namespace.
   * @param name - The name of the pipeline run to delete.
   * @param namespace - The namespace of the pipeline run.
   * @returns A promise that resolves when the pipeline run is deleted.
   */
  deletePipelineRun(name: string, namespace: string): Promise<void>;

  // Task Operations

  /**
   * Retrieves a task by name.
   * @param name - The name of the task.
   * @param namespace - The namespace of the task.
   * @returns A promise that resolves to the requested Task.
   */
  getTask(name: string, namespace: string): Promise<Task>;

  /**
   * Retrieves the status of a task by name.
   * @param name - The name of the task.
   * @param namespace - The namespace of the task.
   * @returns {TaskRunStatus} A promise that resolves to the status of the requested Task.
   */
  getTaskStatus(name: string, namespace: string): Promise<TaskRunStatus>;

  /**
   * Lists all tasks in the specified namespace.
   * @param namespace - The namespace to list tasks from.
   * @returns A promise that resolves to an array of Tasks.
   */
  listTasks(namespace: string): Promise<Task[]>;

  /**
   * Creates a new task in the specified namespace.
   * @param task - The Task object to create.
   * @param namespace - The namespace where the task will be created.
   * @returns A promise that resolves to the created Task.
   */
  createTask(task: Task, namespace: string): Promise<Task>;

  /**
   * Updates an existing task in the specified namespace.
   * @param task - The Task object with updated data.
   * @param namespace - The namespace of the task.
   * @returns A promise that resolves to the updated Task.
   */
  updateTask(task: Task, namespace: string): Promise<Task>;

  /**
   * Deletes a task by name from the specified namespace.
   * @param name - The name of the task to delete.
   * @param namespace - The namespace of the task.
   * @returns A promise that resolves when the task is deleted.
   */
  deleteTask(name: string, namespace: string): Promise<void>;

  // ClusterTask Operations (Cluster-scoped)

  /**
   * Retrieves a cluster task by name.
   * @param name - The name of the cluster task.
   * @returns A promise that resolves to the requested ClusterTask.
   */
  getClusterTask(name: string): Promise<ClusterTask>;

  /**
   * Lists all cluster tasks.
   * @returns A promise that resolves to an array of ClusterTasks.
   */
  listClusterTasks(): Promise<ClusterTask[]>;

  /**
   * Creates a new cluster task.
   * @param clusterTask - The ClusterTask object to create.
   * @returns A promise that resolves to the created ClusterTask.
   */
  createClusterTask(clusterTask: ClusterTask): Promise<ClusterTask>;

  /**
   * Updates an existing cluster task.
   * @param clusterTask - The ClusterTask object with updated data.
   * @returns A promise that resolves to the updated ClusterTask.
   */
  updateClusterTask(clusterTask: ClusterTask): Promise<ClusterTask>;

  /**
   * Deletes a cluster task by name.
   * @param name - The name of the cluster task to delete.
   * @returns A promise that resolves when the cluster task is deleted.
   */
  deleteClusterTask(name: string): Promise<void>;

  // TaskRun Operations

  /**
   * Retrieves a task run by name.
   * @param name - The name of the task run.
   * @param namespace - The namespace of the task run.
   * @returns A promise that resolves to the requested TaskRun.
   */
  getTaskRun(name: string, namespace: string): Promise<TaskRun>;

  /**
   * Lists all task runs in the specified namespace.
   * @param namespace - The namespace to list task runs from.
   * @returns A promise that resolves to an array of TaskRuns.
   */
  listTaskRuns(namespace: string): Promise<TaskRun[]>;

  /**
   * Creates a new task run in the specified namespace.
   * @param taskRun - The TaskRun object to create.
   * @param namespace - The namespace where the task run will be created.
   * @returns A promise that resolves to the created TaskRun.
   */
  createTaskRun(taskRun: TaskRun, namespace: string): Promise<TaskRun>;

  /**
   * Deletes a task run by name from the specified namespace.
   * @param name - The name of the task run to delete.
   * @param namespace - The namespace of the task run.
   * @returns A promise that resolves when the task run is deleted.
   */
  deleteTaskRun(name: string, namespace: string): Promise<void>;

  // Additional Resource Operations

  /**
   * Retrieves a pipeline resource by name.
   * @param name - The name of the pipeline resource.
   * @param namespace - The namespace of the pipeline resource.
   * @returns A promise that resolves to the requested PipelineResource.
   */
  getPipelineResource(
    name: string,
    namespace: string,
  ): Promise<PipelineResource>;

  /**
   * Lists all pipeline resources in the specified namespace.
   * @param namespace - The namespace to list pipeline resources from.
   * @returns A promise that resolves to an array of PipelineResources.
   */
  listPipelineResources(namespace: string): Promise<PipelineResource[]>;

  // Logs and Watch

  /**
   * Retrieves the logs of a pipeline run.
   * @param name - The name of the pipeline run.
   * @param namespace - The namespace of the pipeline run.
   * @returns An async iterable iterator of log strings.
   */
  getPipelineRunLogs(
    name: string,
    namespace: string,
  ): AsyncIterableIterator<string>;

  /**
   * Watches pipeline runs and executes a callback on events.
   * @param namespace - The namespace to watch pipeline runs in.
   * @param callback - The callback to execute on each watch event.
   * @returns A promise that resolves when watching starts.
   */
  watchPipelineRuns(
    namespace: string,
    callback: (event: WatchEvent<PipelineRun>) => void,
  ): Promise<void>;
}
