// /models/PipelineRun.ts

import { KubernetesResource } from './KubernetesResource';
import { PipelineRunSpec } from './PipelineRunSpec';
import { PipelineRunStatus } from './PipelineRunStatus';

export interface PipelineRun
  extends KubernetesResource<PipelineRunSpec, PipelineRunStatus> {}
