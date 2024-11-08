import { EnvVar } from './EnvVar';

/**
 * Represents a Kubernetes cluster configuration within a kubeconfig file.
 * Contains the cluster name and connection details.
 */
export interface Cluster {
  /**
   * The name of the cluster.
   */
  name: string;

  /**
   * Cluster connection details, including server URL and certificate authority information.
   */
  cluster: {
    /**
     * The server URL for the Kubernetes API.
     */
    server: string;

    /**
     * The path to a file containing the certificate authority for the cluster.
     */
    certificateAuthority?: string;

    /**
     * Base64-encoded certificate authority data for the cluster.
     */
    certificateAuthorityData?: string;

    /**
     * Additional cluster properties as key-value pairs.
     */
    [key: string]: any;
  };
}

/**
 * Represents a Kubernetes user configuration within a kubeconfig file.
 * Contains the user name and authentication details.
 */
export interface User {
  /**
   * The name of the user.
   */
  name: string;

  /**
   * User authentication details, such as tokens, certificates, and optional external auth providers.
   */
  user: {
    /**
     * The token for user authentication.
     */
    token?: string;

    /**
     * The username for basic authentication.
     */
    username?: string;

    /**
     * The password for basic authentication.
     */
    password?: string;

    /**
     * Path to the client certificate file for mutual TLS authentication.
     */
    clientCertificate?: string;

    /**
     * Base64-encoded client certificate data for mutual TLS authentication.
     */
    clientCertificateData?: string;

    /**
     * Path to the client key file for mutual TLS authentication.
     */
    clientKey?: string;

    /**
     * Base64-encoded client key data for mutual TLS authentication.
     */
    clientKeyData?: string;

    /**
     * Configuration for an external authentication provider.
     */
    authProvider?: {
      /**
       * The name of the authentication provider (e.g., "gcp", "azure").
       */
      name: string;

      /**
       * Additional configuration parameters for the auth provider.
       */
      config: { [key: string]: any };
    };

    /**
     * Configuration for an external command execution to obtain credentials.
     */
    exec?: {
      /**
       * The API version for the exec credential plugin (e.g., "client.authentication.k8s.io/v1beta1").
       */
      apiVersion?: string;

      /**
       * The command to run to obtain credentials.
       */
      command: string;

      /**
       * Optional arguments to pass to the command.
       */
      args?: string[];

      /**
       * Environment variables to set for the command execution.
       */
      env?: EnvVar[];
    };

    /**
     * Additional user properties as key-value pairs.
     */
    [key: string]: any;
  };
}

/**
 * Represents a Kubernetes context configuration within a kubeconfig file.
 * Defines the relationship between a cluster and a user within a specific namespace.
 */
export interface Context {
  /**
   * The name of the context.
   */
  name: string;

  /**
   * Context details, including cluster and user associations.
   */
  context: {
    /**
     * The name of the cluster associated with this context.
     */
    cluster: string;

    /**
     * The name of the user associated with this context.
     */
    user: string;

    /**
     * The default namespace for this context.
     */
    namespace?: string;

    /**
     * Additional context properties as key-value pairs.
     */
    [key: string]: any;
  };
}

/**
 * Represents the entire kubeconfig file structure.
 * Contains configuration details for clusters, users, contexts, and the current context.
 */
export interface KubeConfig {
  /**
   * The API version of the kubeconfig file.
   */
  apiVersion?: string;

  /**
   * The kind of the kubeconfig file, typically "Config".
   */
  kind?: string;

  /**
   * User-specific preferences that are not part of any cluster, user, or context configuration.
   */
  preferences?: any;

  /**
   * The name of the currently selected context.
   */
  currentContext?: string;

  /**
   * The list of clusters defined in the kubeconfig file.
   */
  clusters?: Cluster[];

  /**
   * The list of users defined in the kubeconfig file.
   */
  users?: User[];

  /**
   * The list of contexts defined in the kubeconfig file.
   */
  contexts?: Context[];

  /**
   * Cluster-specific connection details referenced by contexts.
   */
  cluster: Cluster['cluster'];

  /**
   * User-specific authentication details referenced by contexts.
   */
  user: User['user'];
}
