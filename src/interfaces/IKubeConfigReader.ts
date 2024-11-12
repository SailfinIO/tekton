// src/interfaces/IKubeConfigReader.ts

import { ResolvedKubeConfig } from '../models';

/**
 * Interface for reading and resolving Kubernetes configuration.
 */
export interface IKubeConfigReader {
  /**
   * Retrieves and resolves the Kubernetes configuration from the kubeconfig file.
   *
   * This method reads the kubeconfig file, parses its content, validates the configuration,
   * and resolves necessary details such as cluster information and user authentication data.
   *
   * @returns A promise that resolves to a {@link ResolvedKubeConfig} object containing the resolved configuration.
   *
   * @throws {@link ConfigFileNotFoundError} If the kubeconfig file is not found at the specified path.
   * @throws {@link InvalidConfigError} If the kubeconfig content is invalid or missing required fields.
   * @throws {@link PemConversionError | PemFormatError} If there is an error converting base64 data to PEM format.
   * @throws {@link ExecAuthError} If exec-based authentication fails.
   * @throws {@link ParsingError} If parsing the kubeconfig YAML fails.
   * @throws {@link KubeConfigError} For any other unexpected errors during the resolution process.
   */
  getKubeConfig(): Promise<ResolvedKubeConfig>;

  /**
   * Retrieves and resolves the in-cluster Kubernetes configuration.
   *
   * This method is intended to be used when the application is running inside a Kubernetes cluster.
   * It reads the service account token and CA certificate from predefined in-cluster paths,
   * validates the presence and correctness of these files, and constructs the server URL based on environment variables.
   *
   * @returns A promise that resolves to a {@link ResolvedKubeConfig} object containing the in-cluster configuration.
   *
   * @throws {@link NotInClusterError} If the necessary environment variables are missing, indicating the application is not running inside a Kubernetes cluster.
   * @throws {@link ConfigFileNotFoundError} If the required in-cluster files (token or CA certificate) are missing.
   * @throws {@link InvalidConfigError} If the in-cluster data (token or CA certificate) is invalid.
   * @throws {@link PemFormatError} If the CA certificate cannot be converted to a valid PEM format.
   * @throws {@link KubeConfigError} For any other unexpected errors during the resolution process.
   */
  getInClusterConfig(): Promise<ResolvedKubeConfig>;
}
