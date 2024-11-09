import { TektonClient } from './TektonClient';
import { IKubernetesClient } from '../interfaces/IKubernetesClient';
import {
  Pipeline,
  PipelineRun,
  Task,
  ClusterTask,
  TaskRun,
  PipelineResource,
  WatchEvent,
  PipelineRunStatus,
  TaskStatus,
} from '../models';
import { ClientError } from '../errors';

jest.mock('../utils/Logger');

describe('TektonClient', () => {
  let mockK8sClient: jest.Mocked<IKubernetesClient>;

  beforeEach(() => {
    mockK8sClient = {
      getResource: jest.fn(),
      listResources: jest.fn(),
      createResource: jest.fn(),
      updateResource: jest.fn(),
      deleteResource: jest.fn(),
      getPodLogs: jest.fn(),
      watchResource: jest.fn(),
    } as unknown as jest.Mocked<IKubernetesClient>;
  });

  describe('create', () => {
    it('should create an instance with provided k8sClient', async () => {
      const client = await TektonClient.create({ k8sClient: mockK8sClient });
      expect(client).toBeInstanceOf(TektonClient);
    });
  });

  describe('Pipeline operations', () => {
    let client: TektonClient;

    beforeEach(async () => {
      client = await TektonClient.create({ k8sClient: mockK8sClient });
    });

    it('should get a pipeline', async () => {
      const pipeline: Pipeline = {
        metadata: { name: 'test-pipeline' },
      } as Pipeline;
      mockK8sClient.getResource.mockResolvedValue(pipeline);

      const result = await client.getPipeline('test-pipeline', {
        namespace: 'default',
      });
      expect(result).toEqual(pipeline);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'Pipeline',
        'test-pipeline',
        'default',
      );
    });

    it('should list pipelines', async () => {
      const pipelines: Pipeline[] = [
        { metadata: { name: 'test-pipeline' } },
      ] as Pipeline[];
      mockK8sClient.listResources.mockResolvedValue(pipelines);

      const result = await client.listPipelines({ namespace: 'default' });
      expect(result).toEqual(pipelines);
      expect(mockK8sClient.listResources).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'Pipeline',
        'default',
        undefined,
        undefined,
      );
    });

    it('should create a pipeline', async () => {
      const pipeline: Pipeline = {
        metadata: { name: 'test-pipeline' },
      } as Pipeline;
      mockK8sClient.createResource.mockResolvedValue(pipeline);

      const result = await client.createPipeline(pipeline, 'default');
      expect(result).toEqual(pipeline);
      expect(mockK8sClient.createResource).toHaveBeenCalledWith(
        pipeline,
        'default',
      );
    });

    it('should update a pipeline', async () => {
      const pipeline: Pipeline = {
        metadata: { name: 'test-pipeline' },
      } as Pipeline;
      mockK8sClient.updateResource.mockResolvedValue(pipeline);

      const result = await client.updatePipeline(pipeline, 'default');
      expect(result).toEqual(pipeline);
      expect(mockK8sClient.updateResource).toHaveBeenCalledWith(
        pipeline,
        'default',
      );
    });

    it('should delete a pipeline', async () => {
      mockK8sClient.deleteResource.mockResolvedValue(undefined);

      await client.deletePipeline('test-pipeline', 'default');
      expect(mockK8sClient.deleteResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'Pipeline',
        'test-pipeline',
        'default',
      );
    });
  });

  describe('PipelineRun operations', () => {
    let client: TektonClient;

    beforeEach(async () => {
      client = await TektonClient.create({ k8sClient: mockK8sClient });
    });

    it('should get a pipeline run', async () => {
      const pipelineRun: PipelineRun = {
        metadata: { name: 'test-pipeline-run' },
      } as PipelineRun;
      mockK8sClient.getResource.mockResolvedValue(pipelineRun);

      const result = await client.getPipelineRun(
        'test-pipeline-run',
        'default',
      );
      expect(result).toEqual(pipelineRun);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'test-pipeline-run',
        'default',
      );
    });

    it('should list pipeline runs', async () => {
      const pipelineRuns: PipelineRun[] = [
        { metadata: { name: 'test-pipeline-run' } },
      ] as PipelineRun[];
      mockK8sClient.listResources.mockResolvedValue(pipelineRuns);

      const result = await client.listPipelineRuns('default');
      expect(result).toEqual(pipelineRuns);
      expect(mockK8sClient.listResources).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'default',
      );
    });

    it('should create a pipeline run', async () => {
      const pipelineRun: PipelineRun = {
        metadata: { name: 'test-pipeline-run' },
      } as PipelineRun;
      mockK8sClient.createResource.mockResolvedValue(pipelineRun);

      const result = await client.createPipelineRun(pipelineRun, 'default');
      expect(result).toEqual(pipelineRun);
      expect(mockK8sClient.createResource).toHaveBeenCalledWith(
        pipelineRun,
        'default',
      );
    });

    it('should delete a pipeline run', async () => {
      mockK8sClient.deleteResource.mockResolvedValue(undefined);

      await client.deletePipelineRun('test-pipeline-run', 'default');
      expect(mockK8sClient.deleteResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'test-pipeline-run',
        'default',
      );
    });

    it('should get pipeline run status when status is defined', async () => {
      const pipelineRunStatus: PipelineRunStatus = {
        startTime: '2024-04-25T10:00:00Z',
        completionTime: '2024-04-25T10:10:00Z',
        // Populate additional necessary fields as per your PipelineRunStatus definition
      };

      const pipelineRun: PipelineRun = {
        metadata: { name: 'test-pipeline-run' },
        status: pipelineRunStatus,
      } as PipelineRun;

      mockK8sClient.getResource.mockResolvedValue(pipelineRun);

      const status = await client.getPipelineRunStatus(
        'test-pipeline-run',
        'default',
      );

      expect(status).toEqual(pipelineRunStatus);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'test-pipeline-run',
        'default',
      );
    });

    it('should throw ClientError when pipeline run has no status', async () => {
      const pipelineRun: PipelineRun = {
        metadata: { name: 'test-pipeline-run' },
        // status is intentionally omitted to simulate undefined status
      } as PipelineRun;

      mockK8sClient.getResource.mockResolvedValue(pipelineRun);

      await expect(
        client.getPipelineRunStatus('test-pipeline-run', 'default'),
      ).rejects.toThrow(ClientError);

      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'test-pipeline-run',
        'default',
      );
    });

    it('should throw ClientError when pipeline run does not exist', async () => {
      mockK8sClient.getResource.mockRejectedValue({
        message: 'Not Found',
        statusCode: 404,
      });

      await expect(
        client.getPipelineRunStatus('non-existent-run', 'default'),
      ).rejects.toThrow(ClientError);

      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'non-existent-run',
        'default',
      );
    });

    it('should handle unexpected API errors gracefully for getPipelineRunStatus', async () => {
      mockK8sClient.getResource.mockRejectedValue(
        new Error('Internal Server Error'),
      );

      await expect(
        client.getPipelineRunStatus('test-pipeline-run', 'default'),
      ).rejects.toThrow(ClientError);

      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'test-pipeline-run',
        'default',
      );
    });

    it('should fetch logs for a single task run with a podName', async () => {
      const pipelineRun: PipelineRun = {
        apiVersion: 'tekton.dev/v1beta1',
        kind: 'PipelineRun',
        metadata: { name: 'test-pipeline-run' },
        status: {
          taskRuns: {
            'test-task-run-1': {
              podName: 'test-pod-1',
            },
          },
        },
      } as PipelineRun;

      const podLogs = 'Logs for test-pod-1';
      mockK8sClient.getResource.mockResolvedValue(pipelineRun);
      mockK8sClient.getPodLogs.mockResolvedValue(podLogs);

      const logs = [];
      for await (const log of client.getPipelineRunLogs(
        'test-pipeline-run',
        'default',
      )) {
        logs.push(log);
      }

      expect(logs).toEqual([`Logs for TaskRun test-task-run-1:\n${podLogs}`]);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'test-pipeline-run',
        'default',
      );
      expect(mockK8sClient.getPodLogs).toHaveBeenCalledWith(
        'test-pod-1',
        'default',
      );
    });

    it('should fetch logs for multiple task runs with podNames', async () => {
      const pipelineRun: PipelineRun = {
        apiVersion: 'tekton.dev/v1beta1',
        kind: 'PipelineRun',
        metadata: { name: 'multi-task-run-pipeline-run' },
        status: {
          taskRuns: {
            'task-run-1': { podName: 'pod-1' },
            'task-run-2': { podName: 'pod-2' },
          },
        },
      } as PipelineRun;

      const podLogs1 = 'Logs for pod-1';
      const podLogs2 = 'Logs for pod-2';
      mockK8sClient.getResource.mockResolvedValue(pipelineRun);
      mockK8sClient.getPodLogs
        .mockResolvedValueOnce(podLogs1)
        .mockResolvedValueOnce(podLogs2);

      const logs = [];
      for await (const log of client.getPipelineRunLogs(
        'multi-task-run-pipeline-run',
        'default',
      )) {
        logs.push(log);
      }

      expect(logs).toEqual([
        `Logs for TaskRun task-run-1:\n${podLogs1}`,
        `Logs for TaskRun task-run-2:\n${podLogs2}`,
      ]);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'multi-task-run-pipeline-run',
        'default',
      );
      expect(mockK8sClient.getPodLogs).toHaveBeenNthCalledWith(
        1,
        'pod-1',
        'default',
      );
      expect(mockK8sClient.getPodLogs).toHaveBeenNthCalledWith(
        2,
        'pod-2',
        'default',
      );
    });

    it('should not yield any logs when PipelineRun has no taskRuns', async () => {
      const pipelineRun: PipelineRun = {
        apiVersion: 'tekton.dev/v1beta1',
        kind: 'PipelineRun',
        metadata: { name: 'no-taskruns-pipeline-run' },
        status: {
          // taskRuns is undefined
        },
      } as PipelineRun;

      mockK8sClient.getResource.mockResolvedValue(pipelineRun);

      const logs = [];
      for await (const log of client.getPipelineRunLogs(
        'no-taskruns-pipeline-run',
        'default',
      )) {
        logs.push(log);
      }

      expect(logs).toEqual([]);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'no-taskruns-pipeline-run',
        'default',
      );
      expect(mockK8sClient.getPodLogs).not.toHaveBeenCalled();
    });

    it('should skip task runs without podName and fetch logs for others', async () => {
      const pipelineRun: PipelineRun = {
        apiVersion: 'tekton.dev/v1beta1',
        kind: 'PipelineRun',
        metadata: { name: 'partial-taskruns-pipeline-run' },
        status: {
          taskRuns: {
            'task-run-1': { podName: 'pod-1' },
            'task-run-2': {}, // podName is missing
          },
        },
      } as PipelineRun;

      const podLogs1 = 'Logs for pod-1';
      mockK8sClient.getResource.mockResolvedValue(pipelineRun);
      mockK8sClient.getPodLogs.mockResolvedValue(podLogs1);

      const logs = [];
      for await (const log of client.getPipelineRunLogs(
        'partial-taskruns-pipeline-run',
        'default',
      )) {
        logs.push(log);
      }

      expect(logs).toEqual([`Logs for TaskRun task-run-1:\n${podLogs1}`]);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'partial-taskruns-pipeline-run',
        'default',
      );
      expect(mockK8sClient.getPodLogs).toHaveBeenCalledWith('pod-1', 'default');
      expect(mockK8sClient.getPodLogs).toHaveBeenCalledTimes(1);
    });

    it('should not yield any logs when PipelineRun has an empty taskRuns object', async () => {
      const pipelineRun: PipelineRun = {
        apiVersion: 'tekton.dev/v1beta1',
        kind: 'PipelineRun',
        metadata: { name: 'empty-taskruns-pipeline-run' },
        status: {
          taskRuns: {},
        },
      } as PipelineRun;

      mockK8sClient.getResource.mockResolvedValue(pipelineRun);

      const logs = [];
      for await (const log of client.getPipelineRunLogs(
        'empty-taskruns-pipeline-run',
        'default',
      )) {
        logs.push(log);
      }

      expect(logs).toEqual([]);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'empty-taskruns-pipeline-run',
        'default',
      );
      expect(mockK8sClient.getPodLogs).not.toHaveBeenCalled();
    });

    it('should fetch logs for TaskRuns with podNames and skip others', async () => {
      const pipelineRun: PipelineRun = {
        apiVersion: 'tekton.dev/v1beta1',
        kind: 'PipelineRun',
        metadata: { name: 'mixed-taskruns-pipeline-run' },
        status: {
          taskRuns: {
            'task-run-1': { podName: 'pod-1' },
            'task-run-2': {}, // No podName
            'task-run-3': { podName: 'pod-3' },
          },
        },
      } as PipelineRun;

      const podLogs1 = 'Logs for pod-1';
      const podLogs3 = 'Logs for pod-3';
      mockK8sClient.getResource.mockResolvedValue(pipelineRun);
      mockK8sClient.getPodLogs
        .mockResolvedValueOnce(podLogs1)
        .mockResolvedValueOnce(podLogs3);

      const logs = [];
      for await (const log of client.getPipelineRunLogs(
        'mixed-taskruns-pipeline-run',
        'default',
      )) {
        logs.push(log);
      }

      expect(logs).toEqual([
        `Logs for TaskRun task-run-1:\n${podLogs1}`,
        `Logs for TaskRun task-run-3:\n${podLogs3}`,
      ]);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'mixed-taskruns-pipeline-run',
        'default',
      );
      expect(mockK8sClient.getPodLogs).toHaveBeenCalledWith('pod-1', 'default');
      expect(mockK8sClient.getPodLogs).toHaveBeenCalledWith('pod-3', 'default');
      expect(mockK8sClient.getPodLogs).toHaveBeenCalledTimes(2);
    });
  });

  describe('Task operations', () => {
    let client: TektonClient;

    beforeEach(async () => {
      client = await TektonClient.create({ k8sClient: mockK8sClient });
    });

    it('should get a task', async () => {
      const task: Task = { metadata: { name: 'test-task' } } as Task;
      mockK8sClient.getResource.mockResolvedValue(task);

      const result = await client.getTask('test-task', 'default');
      expect(result).toEqual(task);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'Task',
        'test-task',
        'default',
      );
    });

    it('should list tasks', async () => {
      const tasks: Task[] = [{ metadata: { name: 'test-task' } }] as Task[];
      mockK8sClient.listResources.mockResolvedValue(tasks);

      const result = await client.listTasks('default');
      expect(result).toEqual(tasks);
      expect(mockK8sClient.listResources).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'Task',
        'default',
      );
    });

    it('should create a task', async () => {
      const task: Task = { metadata: { name: 'test-task' } } as Task;
      mockK8sClient.createResource.mockResolvedValue(task);

      const result = await client.createTask(task, 'default');
      expect(result).toEqual(task);
      expect(mockK8sClient.createResource).toHaveBeenCalledWith(
        task,
        'default',
      );
    });

    it('should update a task', async () => {
      const task: Task = { metadata: { name: 'test-task' } } as Task;
      mockK8sClient.updateResource.mockResolvedValue(task);

      const result = await client.updateTask(task, 'default');
      expect(result).toEqual(task);
      expect(mockK8sClient.updateResource).toHaveBeenCalledWith(
        task,
        'default',
      );
    });

    it('should delete a task', async () => {
      mockK8sClient.deleteResource.mockResolvedValue(undefined);

      await client.deleteTask('test-task', 'default');
      expect(mockK8sClient.deleteResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'Task',
        'test-task',
        'default',
      );
    });

    it('should get task status when status is defined', async () => {
      const taskStatus: TaskStatus = {
        steps: [
          // Populate with test step states as per your TaskStatus definition
          {
            name: 'step1',
            container: 'step1-container',
            imageID: 'docker://step1-image-id',
            terminated: {
              exitCode: 0,
              reason: 'Completed',
              startedAt: '2024-04-25T10:00:00Z',
              finishedAt: '2024-04-25T10:05:00Z',
            },
          },
        ],
        startTime: '2024-04-25T10:00:00Z',
        completionTime: '2024-04-25T10:05:00Z',
        podName: 'test-pod',
        // Populate additional necessary fields as per your TaskStatus definition
      };

      const task: Task = {
        metadata: { name: 'test-task' },
        status: taskStatus,
      } as Task;

      mockK8sClient.getResource.mockResolvedValue(task);

      const status = await client.getTaskStatus('test-task', 'default');

      expect(status).toEqual(taskStatus);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'Task',
        'test-task',
        'default',
      );
    });

    it('should throw ClientError when task has no status', async () => {
      const task: Task = {
        metadata: { name: 'test-task' },
        // status is intentionally omitted to simulate undefined status
      } as Task;

      mockK8sClient.getResource.mockResolvedValue(task);

      await expect(
        client.getTaskStatus('test-task', 'default'),
      ).rejects.toThrow(ClientError);

      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'Task',
        'test-task',
        'default',
      );
    });

    it('should throw ClientError when task does not exist', async () => {
      mockK8sClient.getResource.mockRejectedValue({
        message: 'Not Found',
        statusCode: 404,
      });

      await expect(
        client.getTaskStatus('non-existent-task', 'default'),
      ).rejects.toThrow(ClientError);

      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'Task',
        'non-existent-task',
        'default',
      );
    });

    it('should handle unexpected API errors gracefully for getTaskStatus', async () => {
      mockK8sClient.getResource.mockRejectedValue(
        new Error('Internal Server Error'),
      );

      await expect(
        client.getTaskStatus('test-task', 'default'),
      ).rejects.toThrow(ClientError);

      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'Task',
        'test-task',
        'default',
      );
    });

    it('should throw ClientError when fetching logs for a task run fails', async () => {
      const pipelineRun: PipelineRun = {
        apiVersion: 'tekton.dev/v1beta1',
        kind: 'PipelineRun',
        metadata: { name: 'error-taskrun-pipeline-run' },
        status: {
          taskRuns: {
            'task-run-1': { podName: 'pod-1' },
          },
        },
      } as PipelineRun;

      mockK8sClient.getResource.mockResolvedValue(pipelineRun);
      mockK8sClient.getPodLogs.mockRejectedValue(
        new Error('Failed to fetch pod logs'),
      );

      const logs = [];
      await expect(async () => {
        for await (const log of client.getPipelineRunLogs(
          'error-taskrun-pipeline-run',
          'default',
        )) {
          logs.push(log);
        }
      }).rejects.toThrow(ClientError);

      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'error-taskrun-pipeline-run',
        'default',
      );
      expect(mockK8sClient.getPodLogs).toHaveBeenCalledWith('pod-1', 'default');
    });

    it('should throw ClientError when fetching PipelineRun fails', async () => {
      mockK8sClient.getResource.mockRejectedValue({
        message: 'Not Found',
        statusCode: 404,
      });

      const logs = [];
      await expect(async () => {
        for await (const log of client.getPipelineRunLogs(
          'non-existent-pipeline-run',
          'default',
        )) {
          logs.push(log);
        }
      }).rejects.toThrow(ClientError);

      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'non-existent-pipeline-run',
        'default',
      );
      expect(mockK8sClient.getPodLogs).not.toHaveBeenCalled();
    });
  });

  describe('ClusterTask operations', () => {
    let client: TektonClient;

    beforeEach(async () => {
      client = await TektonClient.create({ k8sClient: mockK8sClient });
    });

    it('should get a cluster task', async () => {
      const clusterTask: ClusterTask = {
        metadata: { name: 'test-cluster-task' },
      } as ClusterTask;
      mockK8sClient.getResource.mockResolvedValue(clusterTask);

      const result = await client.getClusterTask('test-cluster-task');
      expect(result).toEqual(clusterTask);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'ClusterTask',
        'test-cluster-task',
      );
    });

    it('should list cluster tasks', async () => {
      const clusterTasks: ClusterTask[] = [
        { metadata: { name: 'test-cluster-task' } },
      ] as ClusterTask[];
      mockK8sClient.listResources.mockResolvedValue(clusterTasks);

      const result = await client.listClusterTasks();
      expect(result).toEqual(clusterTasks);
      expect(mockK8sClient.listResources).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'ClusterTask',
      );
    });

    it('should create a cluster task', async () => {
      const clusterTask: ClusterTask = {
        metadata: { name: 'test-cluster-task' },
      } as ClusterTask;
      mockK8sClient.createResource.mockResolvedValue(clusterTask);

      const result = await client.createClusterTask(clusterTask);
      expect(result).toEqual(clusterTask);
      expect(mockK8sClient.createResource).toHaveBeenCalledWith(clusterTask);
    });

    it('should update a cluster task', async () => {
      const clusterTask: ClusterTask = {
        metadata: { name: 'test-cluster-task' },
      } as ClusterTask;
      mockK8sClient.updateResource.mockResolvedValue(clusterTask);

      const result = await client.updateClusterTask(clusterTask);
      expect(result).toEqual(clusterTask);
      expect(mockK8sClient.updateResource).toHaveBeenCalledWith(clusterTask);
    });

    it('should delete a cluster task', async () => {
      mockK8sClient.deleteResource.mockResolvedValue(undefined);

      await client.deleteClusterTask('test-cluster-task');
      expect(mockK8sClient.deleteResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'ClusterTask',
        'test-cluster-task',
      );
    });
  });

  describe('TaskRun operations', () => {
    let client: TektonClient;

    beforeEach(async () => {
      client = await TektonClient.create({ k8sClient: mockK8sClient });
    });

    it('should get a task run', async () => {
      const taskRun: TaskRun = {
        metadata: { name: 'test-task-run' },
      } as TaskRun;
      mockK8sClient.getResource.mockResolvedValue(taskRun);

      const result = await client.getTaskRun('test-task-run', 'default');
      expect(result).toEqual(taskRun);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'TaskRun',
        'test-task-run',
        'default',
      );
    });

    it('should list task runs', async () => {
      const taskRuns: TaskRun[] = [
        { metadata: { name: 'test-task-run' } },
      ] as TaskRun[];
      mockK8sClient.listResources.mockResolvedValue(taskRuns);

      const result = await client.listTaskRuns('default');
      expect(result).toEqual(taskRuns);
      expect(mockK8sClient.listResources).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'TaskRun',
        'default',
      );
    });

    it('should create a task run', async () => {
      const taskRun: TaskRun = {
        metadata: { name: 'test-task-run' },
      } as TaskRun;
      mockK8sClient.createResource.mockResolvedValue(taskRun);

      const result = await client.createTaskRun(taskRun, 'default');
      expect(result).toEqual(taskRun);
      expect(mockK8sClient.createResource).toHaveBeenCalledWith(
        taskRun,
        'default',
      );
    });

    it('should delete a task run', async () => {
      mockK8sClient.deleteResource.mockResolvedValue(undefined);

      await client.deleteTaskRun('test-task-run', 'default');
      expect(mockK8sClient.deleteResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'TaskRun',
        'test-task-run',
        'default',
      );
    });
  });

  describe('PipelineResource operations', () => {
    let client: TektonClient;

    beforeEach(async () => {
      client = await TektonClient.create({ k8sClient: mockK8sClient });
    });

    it('should get a pipeline resource', async () => {
      const pipelineResource: PipelineResource = {
        metadata: { name: 'test-pipeline-resource' },
      } as PipelineResource;
      mockK8sClient.getResource.mockResolvedValue(pipelineResource);

      const result = await client.getPipelineResource(
        'test-pipeline-resource',
        'default',
      );
      expect(result).toEqual(pipelineResource);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1alpha1',
        'PipelineResource',
        'test-pipeline-resource',
        'default',
      );
    });

    it('should list pipeline resources', async () => {
      const pipelineResources: PipelineResource[] = [
        { metadata: { name: 'test-pipeline-resource' } },
      ] as PipelineResource[];
      mockK8sClient.listResources.mockResolvedValue(pipelineResources);

      const result = await client.listPipelineResources('default');
      expect(result).toEqual(pipelineResources);
      expect(mockK8sClient.listResources).toHaveBeenCalledWith(
        'tekton.dev/v1alpha1',
        'PipelineResource',
        'default',
      );
    });
  });

  describe('getPipelineRunLogs', () => {
    let client: TektonClient;

    beforeEach(async () => {
      client = await TektonClient.create({ k8sClient: mockK8sClient });
    });

    it('should fetch logs for a pipeline run', async () => {
      const pipelineRun: PipelineRun = {
        apiVersion: 'tekton.dev/v1beta1',
        kind: 'PipelineRun',
        metadata: { name: 'test-pipeline-run' },
        status: {
          taskRuns: {
            'test-task-run': {
              podName: 'test-pod',
            },
          },
        },
      } as PipelineRun;
      const podLogs = 'test log data';
      mockK8sClient.getResource.mockResolvedValue(pipelineRun);
      mockK8sClient.getPodLogs.mockResolvedValue(podLogs);

      const logs = [];
      for await (const log of client.getPipelineRunLogs(
        'test-pipeline-run',
        'default',
      )) {
        logs.push(log);
      }

      expect(logs).toEqual([`Logs for TaskRun test-task-run:\n${podLogs}`]);
      expect(mockK8sClient.getResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'test-pipeline-run',
        'default',
      );
      expect(mockK8sClient.getPodLogs).toHaveBeenCalledWith(
        'test-pod',
        'default',
      );
    });
  });

  describe('watchPipelineRuns', () => {
    let client: TektonClient;

    beforeEach(async () => {
      client = await TektonClient.create({ k8sClient: mockK8sClient });
    });

    it('should watch pipeline runs', async () => {
      const mockCallback = jest.fn();
      const mockEvent = {
        type: 'ADDED',
        object: { metadata: { name: 'test-pipeline-run' } },
      } as WatchEvent<PipelineRun>;
      mockK8sClient.watchResource.mockImplementation(async function* () {
        yield mockEvent;
      });

      await client.watchPipelineRuns('default', mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(mockEvent);
      expect(mockK8sClient.watchResource).toHaveBeenCalledWith(
        'tekton.dev/v1beta1',
        'PipelineRun',
        'default',
      );
    });
  });
});
