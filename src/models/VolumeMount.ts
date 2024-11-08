/**
 * Represents a volume mount within a container, specifying how a volume should be mounted and accessed.
 * `VolumeMount` configurations allow containers to read from or write to a mounted volume at a specified path.
 */
export interface VolumeMount {
  /**
   * The name of the volume to mount, matching a defined volume in the pod's configuration.
   */
  name: string;

  /**
   * The path within the container where the volume should be mounted.
   * Files from the volume will be accessible at this path in the container’s filesystem.
   *
   * @example
   * mountPath: '/data'
   */
  mountPath: string;

  /**
   * Indicates if the volume should be mounted as read-only.
   * When set to `true`, the container will be unable to write to the volume.
   *
   * @default false
   */
  readOnly?: boolean;

  /**
   * Specifies a sub-path within the volume to mount instead of mounting the entire volume.
   * Useful for isolating a specific directory or file within a volume.
   *
   * @example
   * subPath: 'config/settings.yaml'
   */
  subPath?: string;
}
