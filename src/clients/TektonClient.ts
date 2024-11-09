/**
 * @file TektonClient.ts
 * @fileoverview - Provides a client for interacting with Tekton resources in a Kubernetes cluster.
 * @description - This file provides the TektonClient class, which implements the ITektonClient interface to interact with Tekton resources in a Kubernetes cluster.
 * @summary - The TektonClient class provides methods to interact with Tekton resources in a Kubernetes cluster.
 * @module clients
 * @exports TektonClient
 */

import { IKubernetesClient } from '../interfaces/IKubernetesClient';
import { KubernetesClient } from './KubernetesClient';
import {
  ITektonClient,
  GetOptions,
  ListOptions,
  TektonClientOptions,
} from '../interfaces';
import { Logger } from '../utils/Logger';
import {
  ClusterTask,
  Pipeline,
  PipelineResource,
  PipelineRun,
  PipelineRunStatus,
  Task,
  TaskRun,
  TaskStatus,
  WatchEvent,
} from '../models';
import { ClientError } from '../errors';
import { LogLevel } from '../enums';

/**
 * TektonClient class provides methods to interact with Tekton resources in a Kubernetes cluster.
 * It includes operations for Pipelines, PipelineRuns, Tasks, ClusterTasks, TaskRuns, and PipelineResources.
 * @public
 * @class
 * @implements {ITektonClient}
 * @module clients
 * @description - The TektonClient class provides methods to interact with Tekton resources in a Kubernetes cluster.
 * @summary - The TektonClient class provides methods to interact with Tekton resources in a Kubernetes cluster.
 * @example
 * ```typescript
 * import { TektonClient } from '@sailfin/tekton';
 * import { Pipeline } from './models/Pipeline';
 *
 * const tektonClient = await TektonClient.create();
 * const pipeline: Pipeline = await tektonClient.getPipeline('my-pipeline', { namespace: 'default' });
 * console.log(pipeline);
 * ```
 */
export class TektonClient implements ITektonClient {
  /**
   * Instance of IKubernetesClient used to interact with the Kubernetes cluster.
   */
  private k8sClient: IKubernetesClient;

  /**
   * Logger instance for logging messages.
   */
  private readonly logger = new Logger(TektonClient.name);

  /**
   * Private constructor to enforce the use of the async factory method.
   * @param k8sClient Instance of IKubernetesClient.
   * @param logLevel Desired log level.
   */
  private constructor(
    k8sClient: IKubernetesClient,
    logLevel: LogLevel = LogLevel.INFO,
  ) {
    this.k8sClient = k8sClient;
    this.logger = new Logger(TektonClient.name, logLevel);
  }

  /**
   * Static factory method to create an instance of TektonClient.
   * @param options Optional configuration options including kubeConfigPath, logLevel, and k8sClient.
   * @returns {Promise<TektonClient> } A new instance of TektonClient.
   * @async
   * @public
   * @static
   * @method
   * @example
   * ```typescript
   * import { TektonClient } from '@sailfin/tekton';
   * import { Pipeline } from './models/Pipeline';
   *
   * const tektonClient = await TektonClient.create();
   * const pipeline: Pipeline = await tektonClient.getPipeline('my-pipeline', { namespace: 'default' });
   * console.log(pipeline);
   * ```
   */
  public static async create(
    options?: TektonClientOptions,
  ): Promise<TektonClient> {
    const { kubeConfigPath, logLevel, k8sClient } = options || {};
    let client: IKubernetesClient;

    if (k8sClient) {
      client = k8sClient;
    } else {
      client = await KubernetesClient.create({ kubeConfigPath, logLevel });
    }

    return new TektonClient(client, logLevel);
  }

  /**
   * Get a Pipeline by name. If the Pipeline does not exist, an error is thrown.
   * @param name Name of the Pipeline to get.
   * @param options Options to specify the namespace.
   * @returns {Promise<Pipeline>} A promise that resolves to the requested Pipeline.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const pipeline = await tektonClient.getPipeline('my-pipeline', { namespace: 'default' });
   * console.log(pipeline);
   * ```
   */
  public async getPipeline(
    name: string,
    options: GetOptions,
  ): Promise<Pipeline> {
    return this.executeWithLogging<Pipeline>(
      () =>
        this.k8sClient.getResource<Pipeline>(
          'tekton.dev/v1beta1',
          'Pipeline',
          name,
          options.namespace,
        ),
      `Fetching pipeline: ${name} in namespace: ${options.namespace}`,
      `Failed to get pipeline ${name}`,
      'getPipeline',
      'Pipeline',
      options.namespace,
    );
  }

  /**
   * List all Pipelines based on the provided options.
   * @param options Options to specify the namespace, label selector, and field selector.
   * @returns {Promise<Pipeline[]>} A promise that resolves to an array of Pipelines.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const pipelines = await tektonClient.listPipelines({ namespace: 'default' });
   * console.log(pipelines);
   * ```
   */
  public async listPipelines(options: ListOptions): Promise<Pipeline[]> {
    return this.executeWithLogging<Pipeline[]>(
      () =>
        this.k8sClient.listResources<Pipeline>(
          'tekton.dev/v1beta1',
          'Pipeline',
          options.namespace,
          options.labelSelector,
          options.fieldSelector,
        ),
      `Listing pipelines in namespace: ${options.namespace}`,
      `Failed to list pipelines in namespace ${options.namespace}`,
      'listPipelines',
      'Pipeline',
      options.namespace,
    );
  }

  /**
   * Create a new Pipeline in the specified namespace.
   * @param pipeline The Pipeline object to create.
   * @param namespace The namespace where the pipeline will be created.
   * @returns {Promise<Pipeline> } A promise that resolves to the created Pipeline.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const pipeline = await tektonClient.createPipeline(myPipeline, 'default');
   * console.log(pipeline);
   * ```
   */
  public async createPipeline(
    pipeline: Pipeline,
    namespace: string,
  ): Promise<Pipeline> {
    return this.executeWithLogging<Pipeline>(
      () => this.k8sClient.createResource<Pipeline>(pipeline, namespace),
      `Creating pipeline: ${pipeline.metadata.name} in namespace: ${namespace}`,
      `Failed to create pipeline ${pipeline.metadata.name}`,
      'createPipeline',
      'Pipeline',
      namespace,
    );
  }

  /**
   * Update an existing Pipeline in the specified namespace.
   * @param pipeline The Pipeline object to update.
   * @param namespace The namespace where the pipeline will be updated.
   * @returns {Promise<Pipeline> } A promise that resolves to the updated Pipeline.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const updatedPipeline = await tektonClient.updatePipeline(myPipeline, 'default');
   * console.log(updatedPipeline);
   * ```
   */
  public async updatePipeline(
    pipeline: Pipeline,
    namespace: string,
  ): Promise<Pipeline> {
    return this.executeWithLogging<Pipeline>(
      () => this.k8sClient.updateResource<Pipeline>(pipeline, namespace),
      `Updating pipeline: ${pipeline.metadata.name} in namespace: ${namespace}`,
      `Failed to update pipeline ${pipeline.metadata.name}`,
      'updatePipeline',
      'Pipeline',
      namespace,
    );
  }

  /**
   * Delete a Pipeline by name from the specified namespace.
   * @param name The name of the Pipeline to delete.
   * @param namespace The namespace of the Pipeline.
   * @returns {Promise<void>} A promise that resolves when the Pipeline is deleted.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * await tektonClient.deletePipeline('my-pipeline', 'default');
   * ```
   * @throws {ClientError} If the Pipeline cannot be deleted.
   * @throws {Error} If an unexpected error occurs.
   */
  public async deletePipeline(name: string, namespace: string): Promise<void> {
    return this.executeWithLogging<void>(
      () =>
        this.k8sClient.deleteResource(
          'tekton.dev/v1beta1',
          'Pipeline',
          name,
          namespace,
        ),
      `Deleting pipeline: ${name} in namespace: ${namespace}`,
      `Failed to delete pipeline ${name}`,
      'deletePipeline',
      'Pipeline',
      namespace,
    );
  }

  /**
   * Get a PipelineRun by name. If the PipelineRun does not exist, an error is thrown.
   * @param name Name of the PipelineRun to get.
   * @param namespace Namespace of the PipelineRun.
   * @returns {Promise<PipelineRun>} A promise that resolves to the requested PipelineRun.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const pipelineRun = await tektonClient.getPipelineRun('my-pipeline-run', 'default');
   * console.log(pipelineRun);
   * ```
   */
  public async getPipelineRun(
    name: string,
    namespace: string,
  ): Promise<PipelineRun> {
    return this.executeWithLogging<PipelineRun>(
      () =>
        this.k8sClient.getResource<PipelineRun>(
          'tekton.dev/v1beta1',
          'PipelineRun',
          name,
          namespace,
        ),
      `Fetching pipeline run: ${name} in namespace: ${namespace}`,
      `Failed to get pipeline run ${name}`,
      'getPipelineRun',
      'PipelineRun',
      namespace,
    );
  }

  /**
   * List all PipelineRuns based on the provided options.
   * @param namespace Namespace to list PipelineRuns from.
   * @returns {Promise<PipelineRun[]> } A promise that resolves to an array of PipelineRuns.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const pipelineRuns = await tektonClient.listPipelineRuns('default');
   * console.log(pipelineRuns);
   * ```
   */
  public async listPipelineRuns(namespace: string): Promise<PipelineRun[]> {
    return this.executeWithLogging<PipelineRun[]>(
      () =>
        this.k8sClient.listResources<PipelineRun>(
          'tekton.dev/v1beta1',
          'PipelineRun',
          namespace,
        ),
      `Listing pipeline runs in namespace: ${namespace}`,
      `Failed to list pipeline runs in namespace ${namespace}`,
      'listPipelineRuns',
      'PipelineRun',
      namespace,
    );
  }

  /**
   * Create a new PipelineRun in the specified namespace.
   * @param pipelineRun The PipelineRun object to create.
   * @param namespace The namespace where the pipeline run will be created.
   * @returns {Promise<PipelineRun>}A promise that resolves to the created PipelineRun.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const pipelineRun = await tektonClient.createPipelineRun(myPipelineRun, 'default');
   * console.log(pipelineRun);
   * ```
   */
  public async createPipelineRun(
    pipelineRun: PipelineRun,
    namespace: string,
  ): Promise<PipelineRun> {
    return this.executeWithLogging<PipelineRun>(
      () => this.k8sClient.createResource<PipelineRun>(pipelineRun, namespace),
      `Creating pipeline run in namespace: ${namespace}`,
      `Failed to create pipeline run`,
      'createPipelineRun',
      'PipelineRun',
      namespace,
    );
  }

  /**
   * Update an existing PipelineRun in the specified namespace.
   * @param pipelineRun The PipelineRun object to update.
   * @param namespace The namespace where the pipeline run will be updated.
   * @returns {Promise<PipelineRun>} A promise that resolves to the updated PipelineRun.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const updatedPipelineRun = await tektonClient.updatePipelineRun(myPipelineRun, 'default');
   * console.log(updatedPipelineRun);
   * ```
   */
  public async deletePipelineRun(
    name: string,
    namespace: string,
  ): Promise<void> {
    return this.executeWithLogging<void>(
      () =>
        this.k8sClient.deleteResource(
          'tekton.dev/v1beta1',
          'PipelineRun',
          name,
          namespace,
        ),
      `Deleting pipeline run: ${name} in namespace: ${namespace}`,
      `Failed to delete pipeline run ${name}`,
      'deletePipelineRun',
      'PipelineRun',
      namespace,
    );
  }

  /**
   * Get the status of a PipelineRun by name.
   * @param name Name of the PipelineRun to get the status for.
   * @param namespace Namespace of the PipelineRun.
   * @returns {Promise<PipelineRunStatus>} A promise that resolves to the status of the PipelineRun.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const pipelineRunStatus = await tektonClient.getPipelineRunStatus('my-pipeline-run', 'default');
   * console.log(pipelineRunStatus);
   * ```
   */
  public async getPipelineRunStatus(
    name: string,
    namespace: string,
  ): Promise<PipelineRunStatus> {
    return this.executeWithLogging<PipelineRunStatus>(
      async () => {
        const pipelineRun = await this.getPipelineRun(name, namespace);
        if (!pipelineRun.status) {
          throw new ClientError(
            `PipelineRun ${name} in namespace ${namespace} has no status.`,
            'getPipelineRunStatus',
            'PipelineRun',
            namespace,
          );
        }
        return pipelineRun.status;
      },
      `Fetching pipeline run status: ${name} in namespace: ${namespace}`,
      `Failed to get pipeline run status ${name}`,
      'getPipelineRunStatus',
      'PipelineRun',
      namespace,
    );
  }

  /**
   * Watch for changes to PipelineRuns in the specified namespace.
   * @param namespace Namespace to watch for PipelineRuns.
   * @param callback Function to call when a watch event is received.
   * @returns {Promise<void>} A promise that resolves when the watch is complete.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * tektonClient.watchPipelineRuns('default', (event) => {
   *   console.log(event);
   * });
   * ```
   */
  public async getTask(name: string, namespace: string): Promise<Task> {
    return this.executeWithLogging<Task>(
      () =>
        this.k8sClient.getResource<Task>(
          'tekton.dev/v1beta1',
          'Task',
          name,
          namespace,
        ),
      `Fetching task: ${name} in namespace: ${namespace}`,
      `Failed to get task ${name}`,
      'getTask',
      'Task',
      namespace,
    );
  }

  /**
   * Get the status of a Task by name.
   * @param name Name of the Task to get the status for.
   * @param namespace Namespace of the Task.
   * @returns {Promise<TaskStatus>} A promise that resolves to the status of the Task.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const taskStatus = await tektonClient.getTaskStatus('my-task', 'default');
   * console.log(taskStatus);
   * ```
   */
  public async getTaskStatus(
    name: string,
    namespace: string,
  ): Promise<TaskStatus | undefined> {
    return this.executeWithLogging<TaskStatus>(
      async () => {
        const task = await this.getTask(name, namespace);
        if (!task.status) {
          throw new ClientError(
            `Task ${name} in namespace ${namespace} has no status.`,
            'getTaskStatus',
            'Task',
            namespace,
          );
        }
        return task.status;
      },
      `Fetching task status: ${name} in namespace: ${namespace}`,
      `Failed to get task status ${name}`,
      'getTaskStatus',
      'Task',
      namespace,
    );
  }

  /**
   * List all Tasks based on the provided options.
   * @param namespace Namespace to list Tasks from.
   * @returns {Promise<Task[]>} A promise that resolves to an array of Tasks.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const tasks = await tektonClient.listTasks('default');
   * console.log(tasks);
   * ```
   */
  public async listTasks(namespace: string): Promise<Task[]> {
    return this.executeWithLogging<Task[]>(
      () =>
        this.k8sClient.listResources<Task>(
          'tekton.dev/v1beta1',
          'Task',
          namespace,
        ),
      `Listing tasks in namespace: ${namespace}`,
      `Failed to list tasks in namespace ${namespace}`,
      'listTasks',
      'Task',
      namespace,
    );
  }

  /**
   * Create a new Task in the specified namespace.
   * @param task The Task object to create.
   * @param namespace The namespace where the task will be created.
   * @returns {Promise<Task>} A promise that resolves to the created Task.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const task = await tektonClient.createTask(myTask, 'default');
   * console.log(task);
   * ```
   */
  public async createTask(task: Task, namespace: string): Promise<Task> {
    return this.executeWithLogging<Task>(
      () => this.k8sClient.createResource<Task>(task, namespace),
      `Creating task: ${task.metadata.name} in namespace: ${namespace}`,
      `Failed to create task ${task.metadata.name}`,
      'createTask',
      'Task',
      namespace,
    );
  }

  /**
   * Update an existing Task in the specified namespace.
   * @param task The Task object to update.
   * @param namespace The namespace where the task will be updated.
   * @returns {Promise<Task>} A promise that resolves to the updated Task.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const updatedTask = await tektonClient.updateTask(myTask, 'default');
   * console.log(updatedTask);
   * ```
   */
  public async updateTask(task: Task, namespace: string): Promise<Task> {
    return this.executeWithLogging<Task>(
      () => this.k8sClient.updateResource<Task>(task, namespace),
      `Updating task: ${task.metadata.name} in namespace: ${namespace}`,
      `Failed to update task ${task.metadata.name}`,
      'updateTask',
      'Task',
      namespace,
    );
  }

  /**
   * Delete a Task by name from the specified namespace.
   * @param name The name of the Task to delete.
   * @param namespace The namespace of the Task.
   * @returns {Promise<void>} A promise that resolves when the Task is deleted.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * await tektonClient.deleteTask('my-task', 'default');
   * ```
   * @throws {ClientError} If the Task cannot be deleted.
   * @throws {Error} If an unexpected error occurs.
   */
  public async deleteTask(name: string, namespace: string): Promise<void> {
    return this.executeWithLogging<void>(
      () =>
        this.k8sClient.deleteResource(
          'tekton.dev/v1beta1',
          'Task',
          name,
          namespace,
        ),
      `Deleting task: ${name} in namespace: ${namespace}`,
      `Failed to delete task ${name}`,
      'deleteTask',
      'Task',
      namespace,
    );
  }

  /**
   * Get a ClusterTask by name. If the ClusterTask does not exist, an error is thrown.
   * @param name Name of the ClusterTask to get.
   * @returns {Promise<ClusterTask>} A promise that resolves to the requested ClusterTask.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const clusterTask = await tektonClient.getClusterTask('my-cluster-task');
   * console.log(clusterTask);
   * ```
   */
  public async getClusterTask(name: string): Promise<ClusterTask> {
    return this.executeWithLogging<ClusterTask>(
      () =>
        this.k8sClient.getResource<ClusterTask>(
          'tekton.dev/v1beta1',
          'ClusterTask',
          name,
        ),
      `Fetching cluster task: ${name}`,
      `Failed to get cluster task ${name}`,
      'getClusterTask',
      'ClusterTask',
    );
  }

  /**
   * List all ClusterTasks.
   * @returns {Promise<ClusterTask[]>} A promise that resolves to an array of ClusterTasks.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const clusterTasks = await tektonClient.listClusterTasks();
   * console.log(clusterTasks);
   * ```
   */
  public async listClusterTasks(): Promise<ClusterTask[]> {
    return this.executeWithLogging<ClusterTask[]>(
      () =>
        this.k8sClient.listResources<ClusterTask>(
          'tekton.dev/v1beta1',
          'ClusterTask',
        ),
      `Listing cluster tasks`,
      `Failed to list cluster tasks`,
      'listClusterTasks',
      'ClusterTask',
    );
  }

  /**
   * Create a new ClusterTask.
   * @param clusterTask The ClusterTask object to create.
   * @returns {Promise<ClusterTask>} A promise that resolves to the created ClusterTask.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const clusterTask = await tektonClient.createClusterTask(myClusterTask);
   * console.log(clusterTask);
   * ```
   */
  public async createClusterTask(
    clusterTask: ClusterTask,
  ): Promise<ClusterTask> {
    return this.executeWithLogging<ClusterTask>(
      () => this.k8sClient.createResource<ClusterTask>(clusterTask),
      `Creating cluster task: ${clusterTask.metadata.name}`,
      `Failed to create cluster task ${clusterTask.metadata.name}`,
      'createClusterTask',
      'ClusterTask',
    );
  }

  /**
   * Update an existing ClusterTask.
   * @param clusterTask The ClusterTask object to update.
   * @returns {Promise<ClusterTask>} A promise that resolves to the updated ClusterTask.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const updatedClusterTask = await tektonClient.updateClusterTask(myClusterTask);
   * console.log(updatedClusterTask);
   * ```
   */
  public async updateClusterTask(
    clusterTask: ClusterTask,
  ): Promise<ClusterTask> {
    return this.executeWithLogging<ClusterTask>(
      () => this.k8sClient.updateResource<ClusterTask>(clusterTask),
      `Updating cluster task: ${clusterTask.metadata.name}`,
      `Failed to update cluster task ${clusterTask.metadata.name}`,
      'updateClusterTask',
      'ClusterTask',
    );
  }

  /**
   * Delete a ClusterTask by name.
   * @param name The name of the ClusterTask to delete.
   * @returns {Promise<void>} A promise that resolves when the ClusterTask is deleted.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * await tektonClient.deleteClusterTask('my-cluster-task');
   * ```
   * @throws {ClientError} If the ClusterTask cannot be deleted.
   * @throws {Error} If an unexpected error occurs.
   */
  public async deleteClusterTask(name: string): Promise<void> {
    return this.executeWithLogging<void>(
      () =>
        this.k8sClient.deleteResource(
          'tekton.dev/v1beta1',
          'ClusterTask',
          name,
        ),
      `Deleting cluster task: ${name}`,
      `Failed to delete cluster task ${name}`,
      'deleteClusterTask',
      'ClusterTask',
    );
  }

  /**
   * Get a TaskRun by name. If the TaskRun does not exist, an error is thrown.
   * @param name Name of the TaskRun to get.
   * @param namespace Namespace of the TaskRun.
   * @returns {Promise<TaskRun>} A promise that resolves to the requested TaskRun.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const taskRun = await tektonClient.getTaskRun('my-task-run', 'default');
   * console.log(taskRun);
   * ```
   */
  public async getTaskRun(name: string, namespace: string): Promise<TaskRun> {
    return this.executeWithLogging<TaskRun>(
      () =>
        this.k8sClient.getResource<TaskRun>(
          'tekton.dev/v1beta1',
          'TaskRun',
          name,
          namespace,
        ),
      `Fetching task run: ${name} in namespace: ${namespace}`,
      `Failed to get task run ${name}`,
      'getTaskRun',
      'TaskRun',
      namespace,
    );
  }

  /**
   * List all TaskRuns based on the provided options.
   * @param namespace Namespace to list TaskRuns from.
   * @returns {Promise<TaskRun[]>} A promise that resolves to an array of TaskRuns.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const taskRuns = await tektonClient.listTaskRuns('default');
   * console.log(taskRuns);
   * ```
   */
  public async listTaskRuns(namespace: string): Promise<TaskRun[]> {
    return this.executeWithLogging<TaskRun[]>(
      () =>
        this.k8sClient.listResources<TaskRun>(
          'tekton.dev/v1beta1',
          'TaskRun',
          namespace,
        ),
      `Listing task runs in namespace: ${namespace}`,
      `Failed to list task runs in namespace ${namespace}`,
      'listTaskRuns',
      'TaskRun',
      namespace,
    );
  }

  /**
   * Create a new TaskRun in the specified namespace.
   * @param taskRun The TaskRun object to create.
   * @param namespace The namespace where the task run will be created.
   * @returns {Promise<TaskRun>} A promise that resolves to the created TaskRun.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const taskRun = await tektonClient.createTaskRun(myTaskRun, 'default');
   * console.log(taskRun);
   * ```
   */
  public async createTaskRun(
    taskRun: TaskRun,
    namespace: string,
  ): Promise<TaskRun> {
    return this.executeWithLogging<TaskRun>(
      () => this.k8sClient.createResource<TaskRun>(taskRun, namespace),
      `Creating task run in namespace: ${namespace}`,
      `Failed to create task run`,
      'createTaskRun',
      'TaskRun',
      namespace,
    );
  }

  /**
   * Update an existing TaskRun in the specified namespace.
   * @param taskRun The TaskRun object to update.
   * @param namespace The namespace where the task run will be updated.
   * @returns {Promise<TaskRun>} A promise that resolves to the updated TaskRun.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const updatedTaskRun = await tektonClient.updateTaskRun(myTaskRun, 'default');
   * console.log(updatedTaskRun);
   * ```
   */
  public async deleteTaskRun(name: string, namespace: string): Promise<void> {
    return this.executeWithLogging<void>(
      () =>
        this.k8sClient.deleteResource(
          'tekton.dev/v1beta1',
          'TaskRun',
          name,
          namespace,
        ),
      `Deleting task run: ${name} in namespace: ${namespace}`,
      `Failed to delete task run ${name}`,
      'deleteTaskRun',
      'TaskRun',
      namespace,
    );
  }

  /**
   * Get the status of a TaskRun by name.
   * @param name Name of the TaskRun to get the status for.
   * @param namespace Namespace of the TaskRun.
   * @returns {Promise<TaskStatus>} A promise that resolves to the status of the TaskRun.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const taskRunStatus = await tektonClient.getTaskRunStatus('my-task-run', 'default');
   * console.log(taskRunStatus);
   * ```
   */
  public async getPipelineResource(
    name: string,
    namespace: string,
  ): Promise<PipelineResource> {
    return this.executeWithLogging<PipelineResource>(
      () =>
        this.k8sClient.getResource<PipelineResource>(
          'tekton.dev/v1alpha1',
          'PipelineResource',
          name,
          namespace,
        ),
      `Fetching pipeline resource: ${name} in namespace: ${namespace}`,
      `Failed to get pipeline resource ${name}`,
      'getPipelineResource',
      'PipelineResource',
      namespace,
    );
  }

  /**
   * List all PipelineResources based on the provided options.
   * @param namespace Namespace to list PipelineResources from.
   * @returns {Promise<PipelineResource[]>} A promise that resolves to an array of PipelineResources.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const pipelineResources = await tektonClient.listPipelineResources('default');
   * console.log(pipelineResources);
   * ```
   */
  public async listPipelineResources(
    namespace: string,
  ): Promise<PipelineResource[]> {
    return this.executeWithLogging<PipelineResource[]>(
      () =>
        this.k8sClient.listResources<PipelineResource>(
          'tekton.dev/v1alpha1',
          'PipelineResource',
          namespace,
        ),
      `Listing pipeline resources in namespace: ${namespace}`,
      `Failed to list pipeline resources in namespace ${namespace}`,
      'listPipelineResources',
      'PipelineResource',
      namespace,
    );
  }

  /**
   * Create a new PipelineResource in the specified namespace.
   * @param pipelineResource The PipelineResource object to create.
   * @param namespace The namespace where the pipeline resource will be created.
   * @returns {Promise<PipelineResource>} A promise that resolves to the created PipelineResource.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * const pipelineResource = await tektonClient.createPipelineResource(myPipelineResource, 'default');
   * console.log(pipelineResource);
   * ```
   */
  public async *getPipelineRunLogs(
    name: string,
    namespace: string,
  ): AsyncIterableIterator<string> {
    try {
      this.logger.info(
        `Fetching logs for pipeline run: ${name} in namespace: ${namespace}`,
      );
      // Fetch the PipelineRun to get associated TaskRuns
      const pipelineRun = await this.getPipelineRun(name, namespace);

      if (pipelineRun.status && pipelineRun.status.taskRuns) {
        for (const taskRunName in pipelineRun.status.taskRuns) {
          const taskRunStatus = pipelineRun.status.taskRuns[taskRunName];
          try {
            if (taskRunStatus && taskRunStatus.podName) {
              const podName = taskRunStatus.podName;
              const podLogs = await this.k8sClient.getPodLogs(
                podName,
                namespace,
              );
              yield `Logs for TaskRun ${taskRunName}:
${podLogs}`;
            }
          } catch (error: any) {
            this.logger.error(
              `Error fetching logs for TaskRun ${taskRunName}: ${error.message}`,
              error,
            );
            throw new ClientError(
              `Failed to get logs for TaskRun ${taskRunName}: ${error.message}`,
              'getPipelineRunLogs',
              'TaskRun',
              namespace,
            );
          }
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Error fetching pipeline run logs for ${name}: ${error.message}`,
        error,
      );
      throw new ClientError(
        `Failed to get pipeline run logs for ${name}: ${error.message}`,
        'getPipelineRunLogs',
        'PipelineRun',
        namespace,
      );
    }
  }

  /**
   * Watch for changes to TaskRuns in the specified namespace.
   * @param namespace Namespace to watch for TaskRuns.
   * @param callback Function to call when a watch event is received.
   * @returns {Promise<void>} A promise that resolves when the watch is complete.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * tektonClient.watchTaskRuns('default', (event) => {
   *   console.log(event);
   * });
   * ```
   */
  public async watchPipelineRuns(
    namespace: string,
    callback: (event: WatchEvent<PipelineRun>) => void,
  ): Promise<void> {
    return this.executeWithLogging<void>(
      async () => {
        for await (const event of this.k8sClient.watchResource<PipelineRun>(
          'tekton.dev/v1beta1',
          'PipelineRun',
          namespace,
        )) {
          callback(event);
        }
      },
      `Watching PipelineRuns in namespace: ${namespace}`,
      `Failed to watch PipelineRuns in namespace ${namespace}`,
      'watchPipelineRuns',
      'PipelineRun',
      namespace,
    );
  }

  /**
   * Watch for changes to TaskRuns in the specified namespace.
   * @param namespace Namespace to watch for TaskRuns.
   * @param callback Function to call when a watch event is received.
   * @returns {Promise<void>} A promise that resolves when the watch is complete.
   * @async
   * @public
   * @method
   * @example
   * ```typescript
   * tektonClient.watchTaskRuns('default', (event) => {
   *   console.log(event);
   * });
   * ```
   */
  private async executeWithLogging<T>(
    action: () => Promise<T>,
    successMessage: string,
    errorMessage: string,
    method: string,
    resourceName: string,
    namespace?: string,
  ): Promise<T> {
    try {
      this.logger.info(successMessage);
      const result = await action();
      this.logger.info(`Success: ${successMessage}`);
      return result;
    } catch (error: any) {
      this.logger.error(`${errorMessage}: ${error.message}`, error);
      throw new ClientError(errorMessage, method, resourceName, namespace);
    }
  }
}
