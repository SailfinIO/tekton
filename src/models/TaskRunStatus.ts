// src/models/TaskRunStatus.ts

import { TaskResult } from './TaskResult';

export interface TaskRunStatus {
  steps?: StepState[];
  startTime?: string;
  completionTime?: string;
  podName?: string;
  taskResults?: TaskResult[];
  retriesStatus?: TaskRunStatus[];
}

export interface StepState {
  name: string;
  container: string;
  imageID: string;
  terminated?: {
    exitCode: number;
    reason: string;
    startedAt: string;
    finishedAt: string;
  };
}
