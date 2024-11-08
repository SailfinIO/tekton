import { EnvVar } from './EnvVar';
import { Volume } from './Volume';

/**
 * Represents a sidecar container within a Kubernetes Pod, which runs alongside the main application container.
 * Sidecars are often used to provide auxiliary functionality, such as logging, monitoring, or proxying.
 */
export interface Sidecar {
  /**
   * The name of the sidecar container, used to identify it within the Pod.
   */
  name: string;

  /**
   * The image to use for the sidecar container, typically specified as a Docker image reference (e.g., "nginx:latest").
   */
  image: string;

  /**
   * The command to execute in the sidecar container, overriding the default entrypoint of the image.
   * Useful for customizing the behavior of the sidecar container.
   *
   * @example
   * command: ['node', 'app.js']
   */
  command?: string[];

  /**
   * Arguments to pass to the sidecar container's command.
   * These are appended to the command and can be used to further customize execution.
   *
   * @example
   * args: ['--config', '/etc/config.yaml']
   */
  args?: string[];

  /**
   * A list of environment variables to set in the sidecar container.
   * Allows for configuration of the container through key-value pairs.
   */
  env?: EnvVar[];

  /**
   * A list of volumes to mount within the sidecar container.
   * Used to provide the container with access to storage, such as shared files or configuration data.
   *
   * @example
   * volumeMounts: [
   *   { name: 'shared-data', mountPath: '/data' }
   * ]
   */
  volumeMounts?: Volume[];
}
