// src/interfaces/ITektonClient.ts

import {
  ClusterTask,
  Pipeline,
  PipelineResource,
  PipelineRun,
  Task,
  TaskRun,
  WatchEvent,
} from '../models';

export interface GetOptions {
  namespace: string;
  labelSelector?: string;
  fieldSelector?: string;
}
export interface ListOptions {
  namespace?: string;
  labelSelector?: string;
  fieldSelector?: string;
}

export interface ITektonClient {
  // Pipeline Operations
  getPipeline(name: string, options: GetOptions): Promise<Pipeline>;
  listPipelines(options: ListOptions): Promise<Pipeline[]>;
  createPipeline(pipeline: Pipeline, namespace: string): Promise<Pipeline>;
  updatePipeline(pipeline: Pipeline, namespace: string): Promise<Pipeline>;
  deletePipeline(name: string, namespace: string): Promise<void>;

  // PipelineRun Operations
  getPipelineRun(name: string, namespace: string): Promise<PipelineRun>;
  listPipelineRuns(namespace: string): Promise<PipelineRun[]>;
  createPipelineRun(
    pipelineRun: PipelineRun,
    namespace: string,
  ): Promise<PipelineRun>;
  deletePipelineRun(name: string, namespace: string): Promise<void>;

  // Task Operations
  getTask(name: string, namespace: string): Promise<Task>;
  listTasks(namespace: string): Promise<Task[]>;
  createTask(task: Task, namespace: string): Promise<Task>;
  updateTask(task: Task, namespace: string): Promise<Task>;
  deleteTask(name: string, namespace: string): Promise<void>;

  // ClusterTask Operations (Cluster-scoped)
  getClusterTask(name: string): Promise<ClusterTask>;
  listClusterTasks(): Promise<ClusterTask[]>;
  createClusterTask(clusterTask: ClusterTask): Promise<ClusterTask>;
  updateClusterTask(clusterTask: ClusterTask): Promise<ClusterTask>;
  deleteClusterTask(name: string): Promise<void>;

  // TaskRun Operations
  getTaskRun(name: string, namespace: string): Promise<TaskRun>;
  listTaskRuns(namespace: string): Promise<TaskRun[]>;
  createTaskRun(taskRun: TaskRun, namespace: string): Promise<TaskRun>;
  deleteTaskRun(name: string, namespace: string): Promise<void>;

  // Additional Resource Operations
  getPipelineResource(
    name: string,
    namespace: string,
  ): Promise<PipelineResource>;
  listPipelineResources(namespace: string): Promise<PipelineResource[]>;

  // Logs and Watch
  getPipelineRunLogs(
    name: string,
    namespace: string,
  ): AsyncIterableIterator<string>;

  watchPipelineRuns(
    namespace: string,
    callback: (event: WatchEvent<PipelineRun>) => void,
  ): Promise<void>;
}
