// src/models/TaskRun.ts

import { KubernetesResource } from './KubernetesResource';
import { TaskRunSpec } from './TaskRunSpec';
import { TaskRunStatus } from './TaskRunStatus';

export interface TaskRun
  extends KubernetesResource<TaskRunSpec, TaskRunStatus> {}
