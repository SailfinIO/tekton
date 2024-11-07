// src/models/WorkspaceBinding.ts

export interface WorkspaceBinding {
  name: string;
  persistentVolumeClaim?: {
    claimName: string;
  };
  emptyDir?: {};
  configMap?: {
    name: string;
  };
  secret?: {
    secretName: string;
  };
}
