// src/models/ClusterTask.ts
import { KubernetesResource } from './KubernetesResource';
import { TaskSpec, TaskStatus } from './Task';

export interface ClusterTask extends KubernetesResource<TaskSpec, TaskStatus> {}
