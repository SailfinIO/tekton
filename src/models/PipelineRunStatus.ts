// src/models/PipelineRunStatus.ts

import { PipelineSpec } from './Pipeline';
import { PipelineResult } from './PipelineResult';
import { TaskRunStatus } from './TaskRunStatus';

export enum PipelineRunStatusEnum {
  Cancelled = 'PipelineRunCancelled',
  Pending = 'PipelineRunPending',
  Stopped = 'PipelineRunStopped',
}

export interface PipelineRunStatus {
  startTime?: string;
  completionTime?: string;
  pipelineSpec?: PipelineSpec;
  pipelineResults?: PipelineResult[];
  taskRuns?: { [taskRunName: string]: TaskRunStatus };
  childReferences?: ChildStatusReference[];
  skippedTasks?: SkippedTask[];
}

export interface ChildStatusReference {
  type: string; // e.g., 'TaskRun' or 'Run'
  name: string;
  pipelineTaskName: string;
}

export interface SkippedTask {
  name: string;
  reason: string;
}
