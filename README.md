# @sailfin/tekton

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![npm version](https://img.shields.io/npm/v/@sailfin/tekton.svg)
[![CodeQL Advanced](https://github.com/SailfinIO/tekton/actions/workflows/codeql.yml/badge.svg)](https://github.com/SailfinIO/tekton/actions/workflows/codeql.yml)
[![Build](https://github.com/SailfinIO/tekton/actions/workflows/build.yaml/badge.svg)](https://github.com/SailfinIO/tekton/actions/workflows/build.yaml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=SailfinIO_tekton&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=SailfinIO_tekton)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=SailfinIO_tekton&metric=coverage)](https://sonarcloud.io/summary/new_code?id=SailfinIO_tekton)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=SailfinIO_tekton&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=SailfinIO_tekton)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=SailfinIO_tekton&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=SailfinIO_tekton)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=SailfinIO_tekton&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=SailfinIO_tekton)

`@sailfin/tekton` is a robust, enterprise-grade NPM package that provides seamless integration with Tekton and Kubernetes. It offers powerful clients for interacting with Tekton pipelines and Kubernetes resources, enabling developers and DevOps engineers to automate and manage their CI/CD workflows with ease.

**This package it under active development and is not yet ready for production use. Please use with caution and report any issues or bugs you encounter.**

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Getting Started](#getting-started)
  - [Configuration](#configuration)
    - [Using Kubeconfig File](#using-kubeconfig-file)
    - [Using In-Cluster Configuration](#using-in-cluster-configuration)
- [Kubernetes Client Usage](#kubernetes-client-usage)
  - [Example: Managing Pods](#example-managing-pods)
  - [Example: Watching Resources](#example-watching-resources)
- [Tekton Client Usage](#tekton-client-usage)
  - [Example: Managing Pipelines](#example-managing-pipelines)
  - [Example: Fetching PipelineRun Logs](#example-fetching-pipelinerun-logs)
- [API Reference](#api-reference)
  - [KubernetesClient](#kubernetesclient)
  - [TektonClient](#tektonclient)
- [Error Handling](#error-handling)
  - [Example: Handling Errors](#example-handling-errors)
- [Logging](#logging)
  - [Log Levels](#log-levels)
  - [Configuring Log Level](#configuring-log-level)
- [Testing](#testing)
  - [Unit Tests](#unit-tests)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## Features

### Kubernetes Client:

- **Manage Kubernetes resources:** Pods, Services, Deployments, etc.
- **Perform CRUD operations:** Create, Read, Update, Delete.
- **Watch resources** for real-time updates.
- **Fetch pod logs** seamlessly.

### Tekton Client:

- **Manage Tekton resources:** Pipelines, PipelineRuns, Tasks, TaskRuns, ClusterTasks, PipelineResources.
- **Perform CRUD operations** on Tekton resources.
- **Fetch logs** for PipelineRuns and TaskRuns.
- **Watch PipelineRuns** for real-time monitoring.

### Flexible Configuration:

- Supports loading kubeconfig from a specified path or using in-cluster configuration.

### Robust Logging:

- Integrated logging with configurable log levels.

### Error Handling:

- Comprehensive error handling with custom error classes.

## Installation

Install the package via NPM:

```bash
npm install @sailfin/tekton
```

## Getting Started

### Configuration

The clients can be configured using a kubeconfig file or by leveraging in-cluster configuration when running within a Kubernetes cluster.

#### Using Kubeconfig File

```typescript
import { KubernetesClient, TektonClient } from '@sailfin/tekton';

// Specify a custom kubeconfig path
const kubeConfigPath = '/path/to/your/kubeconfig.yaml';

// Create Kubernetes Client
const k8sClient = await KubernetesClient.create(kubeConfigPath);

// Create Tekton Client using the Kubernetes Client
const tektonClient = await TektonClient.create(kubeConfigPath, k8sClient);
```

#### Using In-Cluster Configuration

```typescript
import { KubernetesClient, TektonClient } from '@sailfin/tekton';

// Create Kubernetes Client using in-cluster config
const k8sClient = await KubernetesClient.create();

// Create Tekton Client using the Kubernetes Client
const tektonClient = await TektonClient.create(undefined, k8sClient);
```

## Kubernetes Client Usage

The `KubernetesClient` allows you to manage various Kubernetes resources programmatically.

### Example: Managing Pods

```typescript
import { KubernetesClient } from '@sailfin/tekton';

(async () => {
  const k8sClient = await KubernetesClient.create();

  // Get a Pod
  const pod = await k8sClient.getResource('v1', 'Pod', 'my-pod', 'default');
  console.log('Pod:', pod);

  // List Pods
  const pods = await k8sClient.listResources('v1', 'Pod', 'default');
  console.log('Pods:', pods);

  // Create a Pod
  const newPod = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name: 'new-pod', namespace: 'default' },
    spec: {
      containers: [{ name: 'nginx', image: 'nginx:latest' }],
    },
  };
  const createdPod = await k8sClient.createResource(newPod, 'default');
  console.log('Created Pod:', createdPod);

  // Update a Pod
  createdPod.spec.containers[0].image = 'nginx:1.19';
  const updatedPod = await k8sClient.updateResource(createdPod, 'default');
  console.log('Updated Pod:', updatedPod);

  // Delete a Pod
  await k8sClient.deleteResource('v1', 'Pod', 'new-pod', 'default');
  console.log('Pod deleted successfully');
})();
```

### Example: Watching Resources

```typescript
import { KubernetesClient, WatchEvent } from '@sailfin/tekton';

(async () => {
  const k8sClient = await KubernetesClient.create();

  // Watch Pods in the 'default' namespace
  for await (const event of k8sClient.watchResource('v1', 'Pod', 'default')) {
    console.log(`Event Type: ${event.type}`);
    console.log('Pod Object:', event.object);
  }
})();
```

## Tekton Client Usage

The `TektonClient` provides methods to interact with Tekton resources, enabling automation of CI/CD pipelines.

### Example: Managing Pipelines

```typescript
import { TektonClient } from '@sailfin/tekton';

(async () => {
  const tektonClient = await TektonClient.create();

  // Create a Pipeline
  const pipeline = {
    apiVersion: 'tekton.dev/v1beta1',
    kind: 'Pipeline',
    metadata: { name: 'my-pipeline', namespace: 'default' },
    spec: {
      tasks: [
        {
          name: 'task-1',
          taskRef: { name: 'example-task' },
        },
      ],
    },
  };
  const createdPipeline = await tektonClient.createPipeline(
    pipeline,
    'default',
  );
  console.log('Created Pipeline:', createdPipeline);

  // Get a Pipeline
  const fetchedPipeline = await tektonClient.getPipeline('my-pipeline', {
    namespace: 'default',
  });
  console.log('Fetched Pipeline:', fetchedPipeline);

  // List Pipelines
  const pipelines = await tektonClient.listPipelines({ namespace: 'default' });
  console.log('Pipelines:', pipelines);

  // Update a Pipeline
  fetchedPipeline.spec.tasks.push({
    name: 'task-2',
    taskRef: { name: 'another-task' },
  });
  const updatedPipeline = await tektonClient.updatePipeline(
    fetchedPipeline,
    'default',
  );
  console.log('Updated Pipeline:', updatedPipeline);

  // Delete a Pipeline
  await tektonClient.deletePipeline('my-pipeline', 'default');
  console.log('Pipeline deleted successfully');
})();
```

### Example: Fetching PipelineRun Logs

```typescript
import { TektonClient } from '@sailfin/tekton';

(async () => {
  const tektonClient = await TektonClient.create();

  const pipelineRunName = 'my-pipeline-run';
  const namespace = 'default';

  for await (const log of tektonClient.getPipelineRunLogs(
    pipelineRunName,
    namespace,
  )) {
    console.log(log);
  }
})();
```

## API Reference

### KubernetesClient

The `KubernetesClient` class provides methods to interact with Kubernetes resources.

#### Methods

- `create(kubeConfigPath?: string): Promise<KubernetesClient>`

  Creates a new instance of the **KubernetesClient**.

  Parameters:

  - `kubeConfigPath` (optional): Path to the kubeconfig file. Defaults to `~/.kube/config`.
    Returns: A Promise that resolves to a new instance of **KubernetesClient**.

- `getResource<T extends KubernetesResource>(apiVersion: string, kind: string, name: string, namespace?: string): Promise<T>`
  Fetches a Kubernetes resource by name.
  Parameters:

  - `apiVersion`: API version of the resource.
  - `kind`: Kind of the resource.
  - `name`: Name of the resource.
  - `namespace` (optional): Namespace of the resource. Defaults to `default`.
    Returns: A Promise that resolves to the fetched resource.

- `listResources<T extends KubernetesResource>(apiVersion: string, kind: string, namespace?: string, labelSelector?: string, fieldSelector?: string): Promise<T[]>`
  Lists Kubernetes resources.
  Parameters:

  - `apiVersion`: API version of the resource.
  - `kind`: Kind of the resource.
  - `namespace` (optional): Namespace of the resource. Defaults to `default`.
  - `labelSelector` (optional): Label selector for filtering resources.
  - `fieldSelector` (optional): Field selector for filtering resources.
    Returns: A Promise that resolves to an array of resources.

- `createResource<T extends KubernetesResource>(resource: T, namespace?: string): Promise<T>`
  Creates a new Kubernetes resource.
  Parameters:

  - `resource`: Resource object to create.
  - `namespace` (optional): Namespace of the resource. Defaults to `default`.
    Returns: A Promise that resolves to the created resource.

- `updateResource<T extends KubernetesResource>(resource: T, namespace?: string): Promise<T>`
  Updates an existing Kubernetes resource.
  Parameters:

  - `resource`: Resource object to update.
  - `namespace` (optional): Namespace of the resource. Defaults to `default`.
    Returns: A Promise that resolves to the updated resource.

- `deleteResource(apiVersion: string, kind: string, name: string, namespace?: string): Promise<void>`
  Deletes a Kubernetes resource by name.
  Parameters:

  - `apiVersion`: API version of the resource.
  - `kind`: Kind of the resource.
  - `name`: Name of the resource.
  - `namespace` (optional): Namespace of the resource. Defaults to `default`.
    Returns: A Promise that resolves when the resource is deleted.

- `watchResource<T extends KubernetesResource>(apiVersion: string, kind: string, namespace: string, labelSelector?: string, fieldSelector?: string): AsyncGenerator<WatchEvent<T>>`
  Watches Kubernetes resources for real-time updates.
  Parameters:

  - `apiVersion`: API version of the resource.
  - `kind`: Kind of the resource.
  - `namespace`: Namespace of the resource.
  - `labelSelector` (optional): Label selector for filtering resources.
  - `fieldSelector` (optional): Field selector for filtering resources.
    Returns: An async generator that yields watch events.

- `getPodLogs(podName: string, namespace: string, containerName?: string): Promise<string>`
  Fetches logs for a Pod.
  Parameters:
  - `podName`: Name of the Pod.
  - `namespace`: Namespace of the Pod.
  - `containerName` (optional): Name of the container. Defaults to the first container in the Pod.
    Returns: A Promise that resolves to the logs.

### TektonClient

The `TektonClient` class provides methods to interact with Tekton resources.

#### Methods

- `create(kubeConfigPath?: string, k8sClient?: IKubernetesClient): Promise<TektonClient>`
  Creates a new instance of the `TektonClient`.
  Parameters:

  - `kubeConfigPath` (optional): Path to the kubeconfig file. Defaults to `~/.kube/config`.
  - `k8sClient` (optional): Instance of `KubernetesClient`. If provided, the `TektonClient` will use this client for interacting with Kubernetes resources.
    Returns: A Promise that resolves to a new instance of `TektonClient`.

- `getPipeline(name: string, options: GetOptions): Promise<Pipeline>`
  Fetches a Pipeline by name.
  Parameters:

  - `name`: Name of the Pipeline.
  - `options`: Options for fetching the Pipeline.
    Returns: A Promise that resolves to the fetched Pipeline.

- `listPipelines(options: ListOptions): Promise<Pipeline[]>`
  Lists Pipelines.
  Parameters:

  - `options`: Options for listing Pipelines.
    Returns: A Promise that resolves to an array of Pipelines.

- `createPipeline(pipeline: Pipeline, namespace: string): Promise<Pipeline>`
  Creates a new Pipeline.
  Parameters:

  - `pipeline`: Pipeline object to create.
  - `namespace`: Namespace of the Pipeline.
    Returns: A Promise that resolves to the created Pipeline.

- `updatePipeline(pipeline: Pipeline, namespace: string): Promise<Pipeline>`
  Updates an existing Pipeline.
  Parameters:

  - `pipeline`: Pipeline object to update.
  - `namespace`: Namespace of the Pipeline.
    Returns: A Promise that resolves to the updated Pipeline.

- `deletePipeline(name: string, namespace: string): Promise<void>`
  Deletes a Pipeline by name.
  Parameters:

  - `name`: Name of the Pipeline.
  - `namespace`: Namespace of the Pipeline.
    Returns: A Promise that resolves when the Pipeline is deleted.

- `getPipelineRun(name: string, namespace: string): Promise<PipelineRun>`
  Fetches a PipelineRun by name.
  Parameters:

  - `name`: Name of the PipelineRun.
  - `namespace`: Namespace of the PipelineRun.
    Returns: A Promise that resolves to the fetched PipelineRun.

- `listPipelineRuns(namespace: string): Promise<PipelineRun[]>`
  Lists PipelineRuns.
  Parameters:

  - `namespace`: Namespace of the PipelineRuns.
    Returns: A Promise that resolves to an array of PipelineRuns.

- `createPipelineRun(pipelineRun: PipelineRun, namespace: string): Promise<PipelineRun>`
  Creates a new PipelineRun.
  Parameters:

  - `pipelineRun`: PipelineRun object to create.
  - `namespace`: Namespace of the PipelineRun.
    Returns: A Promise that resolves to the created PipelineRun.

- `deletePipelineRun(name: string, namespace: string): Promise<void>`
  Deletes a PipelineRun by name.
  Parameters:

  - `name`: Name of the PipelineRun.
  - `namespace`: Namespace of the PipelineRun.
    Returns: A Promise that resolves when the PipelineRun is deleted.

- `getTask(name: string, namespace: string): Promise<Task>`
  Fetches a Task by name.
  Parameters:

  - `name`: Name of the Task.
  - `namespace`: Namespace of the Task.
    Returns: A Promise that resolves to the fetched Task.

- `listTasks(namespace: string): Promise<Task[]>`
  Lists Tasks.
  Parameters:

  - `namespace`: Namespace of the Tasks.
    Returns: A Promise that resolves to an array of Tasks.

- `createTask(task: Task, namespace: string): Promise<Task>`
  Creates a new Task.
  Parameters:

  - `task`: Task object to create.
  - `namespace`: Namespace of the Task.
    Returns: A Promise that resolves to the created Task.

- `updateTask(task: Task, namespace: string): Promise<Task>`
  Updates an existing Task.
  Parameters:

  - `task`: Task object to update.
  - `namespace`: Namespace of the Task.
    Returns: A Promise that resolves to the updated Task.

- `deleteTask(name: string, namespace: string): Promise<void>`
  Deletes a Task by name.
  Parameters:

  - `name`: Name of the Task.
  - `namespace`: Namespace of the Task.
    Returns: A Promise that resolves when the Task is deleted.

- `getClusterTask(name: string): Promise<ClusterTask>`
  Fetches a ClusterTask by name.
  Parameters:

  - `name`: Name of the ClusterTask.
    Returns: A Promise that resolves to the fetched ClusterTask.

- `listClusterTasks(): Promise<ClusterTask[]>`
  Lists ClusterTasks.
  Returns: A Promise that resolves to an array of ClusterTasks.

- `createClusterTask(clusterTask: ClusterTask): Promise<ClusterTask>`
  Creates a new ClusterTask.
  Parameters:

  - `clusterTask`: ClusterTask object to create.
    Returns: A Promise that resolves to the created ClusterTask.

- `updateClusterTask(clusterTask: ClusterTask): Promise<ClusterTask>`
  Updates an existing ClusterTask.
  Parameters:

  - `clusterTask`: ClusterTask object to update.
    Returns: A Promise that resolves to the updated ClusterTask.

- `deleteClusterTask(name: string): Promise<void>`
  Deletes a ClusterTask by name.
  Parameters:

  - `name`: Name of the ClusterTask.
    Returns: A Promise that resolves when the ClusterTask is deleted.

- `getTaskRun(name: string, namespace: string): Promise<TaskRun>`
  Fetches a TaskRun by name.
  Parameters:

  - `name`: Name of the TaskRun.
  - `namespace`: Namespace of the TaskRun.
    Returns: A Promise that resolves to the fetched TaskRun.

- `listTaskRuns(namespace: string): Promise<TaskRun[]>`
  Lists TaskRuns.
  Parameters:

  - `namespace`: Namespace of the TaskRuns.
    Returns: A Promise that resolves to an array of TaskRuns.

- `createTaskRun(taskRun: TaskRun, namespace: string): Promise<TaskRun>`
  Creates a new TaskRun.
  Parameters:

  - `taskRun`: TaskRun object to create.
  - `namespace`: Namespace of the TaskRun.
    Returns: A Promise that resolves to the created TaskRun.

- `deleteTaskRun(name: string, namespace: string): Promise<void>`
  Deletes a TaskRun by name.
  Parameters:

  - `name`: Name of the TaskRun.
  - `namespace`: Namespace of the TaskRun.
    Returns: A Promise that resolves when the TaskRun is deleted.

- `getPipelineResource(name: string, namespace: string): Promise<PipelineResource>`
  Fetches a PipelineResource by name.
  Parameters:

  - `name`: Name of the PipelineResource.
  - `namespace`: Namespace of the PipelineResource.
    Returns: A Promise that resolves to the fetched PipelineResource.

- `listPipelineResources(namespace: string): Promise<PipelineResource[]>`
  Lists PipelineResources.
  Parameters:

  - `namespace`: Namespace of the PipelineResources.
    Returns: A Promise that resolves to an array of PipelineResources.

- `getPipelineRunLogs(name: string, namespace: string): AsyncIterableIterator<string>`
  Fetches logs for a PipelineRun.
  Parameters:

  - `name`: Name of the PipelineRun.
  - `namespace`: Namespace of the PipelineRun.
    Returns: An async iterable that yields logs.

- `watchPipelineRuns(namespace: string, callback: (event: WatchEvent<PipelineRun>) => void): Promise<void>`
  Watches PipelineRuns for real-time updates.
  Parameters:
  - `namespace`: Namespace of the PipelineRuns.
  - `callback`: Callback function to handle watch events.
    Returns: A Promise that resolves when the watch is closed.

## Error Handling

The package provides comprehensive error handling through custom error classes:

- **ApiError**: Represents an error response from the Kubernetes API.
- **ClientError**: Represents an error response from the Tekton/Kubernetes API.
- **NetworkError**: Represents a network-related error.

### Example: Handling Errors

```typescript
import { TektonClient, ClientError } from '@sailfin/tekton';

(async () => {
  try {
    const tektonClient = await TektonClient.create();
    await tektonClient.getPipeline('non-existent-pipeline', {
      namespace: 'default',
    });
  } catch (error) {
    if (error instanceof ClientError) {
      console.error(`Tekton Client Error: ${error.message}`);
      console.error(`Method: ${error.method}`);
      console.error(`Resource: ${error.resourceName}`);
      console.error(`Namespace: ${error.namespace}`);
    } else {
      console.error('Unexpected Error:', error);
    }
  }
})();
```

## Logging

The `KubernetesClient` class includes a robust logging system with configurable log levels. By default, the log level is set to **INFO**, but it can be adjusted by passing a logLevel option when creating the client instance.

### Log Levels

The following log levels are supported:

- **DEBUG**: Detailed information for debugging purposes.
- **INFO**: General information about the application.
- **WARN**: Warnings that may require attention.
- **ERROR**: Errors that need to be addressed.
- **VERBOSE**: Verbose output for detailed logging.

### Configuring Log Level

The log level can be configured using the `setLogLevel` method:

```typescript
import { KubernetesClient, LogLevel } from '@sailfin/tekton';

(async () => {
  // Create KubernetesClient with DEBUG log level
  const k8sClient = await KubernetesClient.create({
    logLevel: LogLevel.DEBUG,
  });

  // Now, DEBUG and above logs will be emitted
})();
```

## Testing

### Unit Tests

To run the unit tests, use the following command:

```bash
npm run test
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the Repository:** Click on the "Fork" button on the top right corner of the repository page.
2. **Clone the Repository:** Clone the forked repository to your local machine.
   ```bash
   git clone https://github.com/your-username/tekton.git
   ```
3. **Create a Branch:** Create a new branch for your feature or bugfix.
   ```bash
   git checkout -b feature/my-feature
   ```
4. **Commit Changes:** Make your changes and commit them with clear messages.
   ```bash
   git commit -m "Add new feature X"
   ```
5. **Push Changes:** Push your changes to your fork.
   ```bash
   git push origin feature/my-feature
   ```
6. **Submit a Pull Request:** Submit a pull request to the main repository.

Please ensure your code adheres to the project's coding standards and includes appropriate tests.

## Support

For support, please [open an issue](https://github.com/SailfinIO/tekton/issues) on the GitHub Issues page or contact the maintainers directly.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
