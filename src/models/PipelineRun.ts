import { KubernetesResource } from './KubernetesResource';
import { PipelineRunSpec } from './PipelineRunSpec';
import { PipelineRunStatus } from './PipelineRunStatus';

/**
 * Represents a Tekton PipelineRun resource, which defines the execution of a Pipeline.
 * Extends the generic KubernetesResource interface with `PipelineRunSpec` for the desired state and `PipelineRunStatus` for the current state.
 * A PipelineRun manages the execution details, status, and results of a specific pipeline instance.
 */
export interface PipelineRun
  extends KubernetesResource<PipelineRunSpec, PipelineRunStatus> {}
