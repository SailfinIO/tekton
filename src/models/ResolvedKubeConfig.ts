import { Cluster, User, Context } from './KubeConfig';

/**
 * Represents a resolved Kubernetes configuration containing selected cluster and user details.
 * Extracted from the full kubeconfig file, `ResolvedKubeConfig` provides only the active cluster and user configurations.
 */
export interface ResolvedKubeConfig {
  /**
   * Configuration details of the selected cluster, including server URL, certificate authority, and other connection settings.
   * Represents the `cluster` object from the kubeconfig.
   */
  cluster: Cluster['cluster'];

  /**
   * Configuration details of the selected user, including authentication tokens, certificates, and other user-specific settings.
   * Represents the `user` object from the kubeconfig.
   */
  user: User['user'];
}
