// src/models/PipelineResource.ts

import { KubernetesResource } from './KubernetesResource';
import { KubernetesMetadata } from './KubernetesMetadata';
import { PipelineResourceSpec } from './PipelineResourceSpec';

export interface PipelineResourceStatus {}

export class PipelineResource
  implements KubernetesResource<PipelineResourceSpec, PipelineResourceStatus>
{
  apiVersion: 'tekton.dev/v1alpha1' = 'tekton.dev/v1alpha1';
  kind: 'PipelineResource' = 'PipelineResource';
  metadata: KubernetesMetadata;
  spec: PipelineResourceSpec;
  status?: PipelineResourceStatus;

  constructor(init?: Partial<PipelineResource>) {
    Object.assign(this, init);
  }
}
