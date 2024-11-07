// src/models/PipelineRunSpec.ts

import { PipelineSpec } from './Pipeline';
import { Param } from './Param';
import { WorkspaceBinding } from './WorkspaceBinding';
import { TimeoutFields } from './TimeoutFields';
import { PodTemplate } from './PodTemplate';
import { PipelineRunStatusEnum } from './PipelineRunStatus';

export interface PipelineRunSpec {
  pipelineRef?: {
    name: string;
  };
  pipelineSpec?: PipelineSpec;
  params?: Param[];
  workspaces?: WorkspaceBinding[];
  timeout?: string;
  timeouts?: TimeoutFields;
  podTemplate?: PodTemplate;
  status?: PipelineRunStatusEnum;
}
