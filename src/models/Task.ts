// src/models/Task.ts

import { KubernetesMetadata } from './KubernetesMetadata';
import { KubernetesResource } from './KubernetesResource';
import { ParamSpec } from './ParamSpec';
import { Sidecar } from './Sidecar';
import { TaskResult } from './TaskResult';
import { Volume } from './Volume';
import { WorkspaceDeclaration } from './WorkspaceDeclaration';
import { EnvVar } from './EnvVar';
import { VolumeMount } from './VolumeMount';
import { ResourceRequirements } from './ResourceRequirements';

export interface TaskSpec {
  steps: Step[];
  params?: ParamSpec[];
  workspaces?: WorkspaceDeclaration[];
  results?: TaskResult[];
  sidecars?: Sidecar[];
  volumes?: Volume[];
}

export interface TaskRef {
  name: string;
  kind?: 'Task' | 'ClusterTask';
}

export interface Step {
  name?: string;
  image: string;
  script?: string;
  args?: string[];
  command?: string[];
  env?: EnvVar[];
  envFrom?: EnvFromSource[];
  volumeMounts?: VolumeMount[];
  resources?: ResourceRequirements;
  workingDir?: string;
  timeout?: string;
}

export interface EnvFromSource {
  configMapRef?: ConfigMapEnvSource;
  secretRef?: SecretEnvSource;
}

export interface ConfigMapEnvSource {
  name: string;
  optional?: boolean;
}

export interface SecretEnvSource {
  name: string;
  optional?: boolean;
}
export interface TaskStatus {}

export class Task implements KubernetesResource {
  apiVersion: 'tekton.dev/v1beta1';
  kind: 'Task';
  metadata: KubernetesMetadata;
  spec: TaskSpec;
  status?: TaskStatus;

  constructor(init?: Partial<Task>) {
    Object.assign(this, init);
  }
}
