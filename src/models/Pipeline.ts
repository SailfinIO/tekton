// src/models/Pipeline.ts

import { KubernetesMetadata } from './KubernetesMetadata';
import { KubernetesResource } from './KubernetesResource';
import { ParamSpec } from './ParamSpec';
import { PipelineResult } from './PipelineResult';
import { Task } from './Task';
import { WorkspaceDeclaration } from './WorkspaceDeclaration';

export interface PipelineSpec {
  tasks: Task[];
  params?: ParamSpec[];
  workspaces?: WorkspaceDeclaration[];
  results?: PipelineResult[];
  finally?: Task[];
}

export interface PipelineStatus {}

export class Pipeline implements KubernetesResource {
  apiVersion: 'tekton.dev/v1beta1';
  kind: 'Pipeline';
  metadata: KubernetesMetadata;
  spec: PipelineSpec;
  status?: PipelineStatus;

  constructor(init?: Partial<Pipeline>) {
    Object.assign(this, init);
  }
}
