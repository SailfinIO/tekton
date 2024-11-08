/**
 * Represents a workspace binding in Tekton, which provides a shared storage resource to a pipeline or task.
 * `WorkspaceBinding` allows specifying different storage sources, including persistent volume claims, empty directories, ConfigMaps, or Secrets.
 */
export interface WorkspaceBinding {
  /**
   * The name of the workspace, used to reference this binding within the pipeline or task.
   */
  name: string;

  /**
   * Specifies a persistent volume claim (PVC) as the workspace storage.
   * The `claimName` identifies the PVC to use for the workspace.
   *
   * @example
   * persistentVolumeClaim: { claimName: 'my-pvc' }
   */
  persistentVolumeClaim?: {
    /**
     * The name of the PVC to use for this workspace.
     */
    claimName: string;
  };

  /**
   * Specifies an empty directory as the workspace storage.
   * An empty directory is created when the pod starts and is removed when the pod terminates.
   * This is often used for temporary storage that does not need to persist beyond the pod's lifecycle.
   *
   * @example
   * emptyDir: {}
   */
  emptyDir?: {};

  /**
   * Specifies a ConfigMap as the workspace storage.
   * The `name` identifies the ConfigMap to mount into the workspace, allowing configuration data to be shared.
   *
   * @example
   * configMap: { name: 'my-config' }
   */
  configMap?: {
    /**
     * The name of the ConfigMap to mount as the workspace.
     */
    name: string;
  };

  /**
   * Specifies a Secret as the workspace storage.
   * The `secretName` identifies the Secret to mount into the workspace, allowing sensitive data to be shared securely.
   *
   * @example
   * secret: { secretName: 'my-secret' }
   */
  secret?: {
    /**
     * The name of the Secret to mount as the workspace.
     */
    secretName: string;
  };
}
