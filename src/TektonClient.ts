import { IKubernetesClient } from './interfaces/IKubernetesClient';
import { KubernetesClient } from './KubernetesClient';
import { ITektonClient, GetOptions, ListOptions } from './interfaces';
import { Logger } from './utils/Logger';
import {
  ClusterTask,
  Pipeline,
  PipelineResource,
  PipelineRun,
  Task,
  TaskRun,
  WatchEvent,
} from './models';
import { TektonClientError } from './errors';

export class TektonClient implements ITektonClient {
  private k8sClient: IKubernetesClient;
  private readonly logger = new Logger(TektonClient.name);

  constructor(kubeConfigPath?: string) {
    this.k8sClient = new KubernetesClient(kubeConfigPath);
  }

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

  // PipelineRun Operations
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

  // Task Operations
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

  // ClusterTask Operations (Cluster-scoped)
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

  // TaskRun Operations
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
            throw new TektonClientError(
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
      throw new TektonClientError(
        `Failed to get pipeline run logs for ${name}: ${error.message}`,
        'getPipelineRunLogs',
        'PipelineRun',
        namespace,
      );
    }
  }

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
      throw new TektonClientError(
        errorMessage,
        method,
        resourceName,
        namespace,
      );
    }
  }
}
