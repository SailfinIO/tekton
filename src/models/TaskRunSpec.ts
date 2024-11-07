// src/models/TaskRunSpec.ts

import { Param } from './Param';
import { PodTemplate } from './PodTemplate';
import { TaskSpec } from './Task';
import { WorkspaceBinding } from './WorkspaceBinding';

export interface TaskRunSpec {
  taskRef?: {
    name: string;
    kind?: 'Task' | 'ClusterTask';
  };
  taskSpec?: TaskSpec;
  params?: Param[];
  serviceAccountName?: string; // Deprecated
  podTemplate?: PodTemplate;
  workspaces?: WorkspaceBinding[];
  timeouts?: {
    start?: string;
    completion?: string;
  };
}
