import { PipelineSpec } from './Pipeline';
import { Param } from './Param';
import { WorkspaceBinding } from './WorkspaceBinding';
import { TimeoutFields } from './TimeoutFields';
import { PodTemplate } from './PodTemplate';
import { PipelineRunStatusEnum } from './PipelineRunStatus';

/**
 * Defines the specification for a Tekton PipelineRun, which configures how a Pipeline should be executed.
 * Specifies the pipeline reference, parameters, workspaces, timeouts, and other runtime configurations.
 */
export interface PipelineRunSpec {
  /**
   * A reference to the name of the Pipeline to be executed.
   * If provided, Tekton will use this pipeline definition for the run.
   */
  pipelineRef?: {
    name: string;
  };

  /**
   * An inline definition of a Pipeline to execute if no pipelineRef is specified.
   * Allows defining a PipelineRun with a custom pipeline specification.
   */
  pipelineSpec?: PipelineSpec;

  /**
   * A list of parameters to pass into the Pipeline during execution.
   * These parameters override default values specified in the Pipeline.
   */
  params?: Param[];

  /**
   * A list of workspaces that are bound to the Pipeline's declared workspaces.
   * These bindings specify the resources, such as storage, that will be available to the Pipeline during execution.
   */
  workspaces?: WorkspaceBinding[];

  /**
   * Specifies the maximum duration for the PipelineRun execution in ISO 8601 duration format (e.g., "1h", "30m").
   */
  timeout?: string;

  /**
   * An object specifying individual timeouts for specific stages of the PipelineRun, such as tasks or finally tasks.
   */
  timeouts?: TimeoutFields;

  /**
   * A template to define the Pod configuration for each task within the PipelineRun.
   * Allows customization of Pod settings such as node selectors, tolerations, and affinity.
   */
  podTemplate?: PodTemplate;

  /**
   * The desired status of the PipelineRun, such as "Running" or "Cancelled".
   * This can be used to pause, resume, or cancel a PipelineRun.
   */
  status?: PipelineRunStatusEnum;
}
