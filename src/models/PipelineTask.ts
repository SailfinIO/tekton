import { Param } from './Param';
import { TaskRef, TaskSpec } from './Task';
import { WhenExpression } from './WhenExpression';
import { WorkspacePipelineTaskBinding } from './WorkspacePipelineTaskBinding';

export interface PipelineTask {
  name: string;
  taskRef?: TaskRef;
  taskSpec?: TaskSpec;
  params?: Param[];
  runAfter?: string[];
  when?: WhenExpression[];
  workspaces?: WorkspacePipelineTaskBinding[];
  retries?: number;
}
