/**
 * @file KubernetesClient.ts
 * @fileoverview This file contains the implementation of the KubernetesClient class.
 * @description This file contains the implementation of the KubernetesClient class, which provides methods for interacting with a Kubernetes cluster using the Kubernetes API.
 * @summary Provides methods for fetching, creating, updating, and deleting resources in a Kubernetes cluster.
 * @module clients
 * @exports KubernetesClient
 */

import { request, RequestOptions } from 'https';
import { URL } from 'url';
import { ResolvedKubeConfig, KubernetesResource, WatchEvent } from '../models';
import {
  FileSystem,
  Logger,
  PemUtils,
  YamlParser,
  KubeConfigReader,
} from '../utils';
import {
  ApiError,
  ClientError,
  KubeConfigError,
  NetworkError,
  ParsingError,
} from '../errors';
import {
  IFileSystem,
  IKubernetesClient,
  ILogger,
  KubernetesClientOptions,
} from '../interfaces';
import { Readable } from 'stream';
import { HttpStatus, LogLevel } from '../enums';
import { KindToResourceNameMap } from '../constants';

/**
 * Client for interacting with a Kubernetes cluster.
 * Provides methods for fetching, creating, updating, and deleting resources.
 * @public
 * @class
 * @implements {IKubernetesClient}
 * @remarks This class is designed to work with Kubernetes clusters using the Kubernetes API.
 * */
export class KubernetesClient implements IKubernetesClient {
  /**
   * Shared FileSystem instance used across KubernetesClient and KubeConfigReader.
   */
  private readonly fileSystem: IFileSystem;

  /**
   * Shared Logger instance used across KubernetesClient and KubeConfigReader.
   */
  private readonly logger: ILogger;

  /**
   * Resolved Kubernetes configuration containing cluster and user details.
   */
  private readonly kubeConfig: ResolvedKubeConfig;

  /**
   * Private constructor to enforce the use of the static `create` method.
   * @param kubeConfig Resolved Kubernetes configuration.
   * @param fileSystem Shared FileSystem instance.
   * @param logger Shared Logger instance.
   */
  private constructor(
    kubeConfig: ResolvedKubeConfig,
    fileSystem: IFileSystem,
    logger: ILogger,
  ) {
    this.kubeConfig = kubeConfig;
    this.fileSystem = fileSystem;
    this.logger = logger;
    this.logger.debug('KubernetesClient initialized.');
  }

  /**
   * Static factory method for creating an instance of KubernetesClient.
   * Attempts to load kubeconfig from the default path if no path is provided.
   * Falls back to in-cluster config if loading from file fails.
   * @param options Optional configuration options.
   * @returns A promise that resolves to a KubernetesClient instance.
   * @throws {ClientError} if kubeconfig cannot be loaded from file or in-cluster.
   * @throws {Error} if an unexpected error occurs while loading kubeconfig.
   * @example Load kubeconfig from a specific path:
   * ```typescript
   * const client = await KubernetesClient.create({ kubeConfigPath: '/path/to/kubeconfig' });
   * ```
   */
  public static async create(
    options?: KubernetesClientOptions & {
      fileSystem?: IFileSystem;
      logger?: ILogger;
    },
  ): Promise<KubernetesClient> {
    const {
      kubeConfigPath,
      logLevel = LogLevel.INFO,
      fileSystem = new FileSystem(),
      logger = new Logger(KubernetesClient.name, logLevel),
    } = options || {};

    const reader = new KubeConfigReader(
      kubeConfigPath,
      fileSystem,
      YamlParser,
      logger,
    );

    let kubeConfig: ResolvedKubeConfig;

    try {
      logger.info('Loading kube config from file.');
      kubeConfig = await reader.getKubeConfig();
      logger.info(
        `Loaded kube config from ${kubeConfigPath || 'default path'}.`,
      );
    } catch (error) {
      if (error instanceof KubeConfigError) {
        logger.warn(
          'Failed to load kubeconfig from file. Attempting to load in-cluster config.',
        );
        try {
          kubeConfig = await reader.getInClusterConfig();
          logger.info('Loaded in-cluster kube config.');
        } catch (inClusterError) {
          logger.error(
            'Failed to load in-cluster kube config.',
            inClusterError,
          );
          throw new ClientError(
            'Unable to load kube config from file or in-cluster.',
            'create',
            'KubeConfig',
            kubeConfigPath,
          );
        }
      } else {
        logger.error('Unexpected error while loading kube config.', error);
        throw error; // Re-throw unexpected errors
      }
    }

    return new KubernetesClient(kubeConfig, fileSystem, logger);
  }

  /**
   * Builds the HTTP request options including authentication and certificates.
   * @param method HTTP method (GET, POST, etc.)
   * @param path API endpoint path
   * @returns {RequestOptions} object
   * @throws {ParsingError} if certificates cannot be read or parsed.
   * @throws {NetworkError} if an error occurs while reading certificates.
   * @example Get request options for a specific path:
   * ```typescript
   * const options = await client.getRequestOptions('GET', '/api/v1/pods');
   * ```
   */
  private async getRequestOptions(
    method: string,
    path: string,
  ): Promise<RequestOptions> {
    this.logger.debug(
      `Building request options for ${method} request to path: ${path}`,
    );
    const { cluster, user } = this.kubeConfig;
    const serverUrl = new URL(cluster.server);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (user.token) {
      headers['Authorization'] = `Bearer ${user.token}`;
    }

    const options: RequestOptions = {
      protocol: serverUrl.protocol,
      hostname: serverUrl.hostname,
      port: serverUrl.port
        ? parseInt(serverUrl.port, 10)
        : serverUrl.protocol === 'https:'
          ? 443
          : 80,
      path,
      method,
      headers,
      rejectUnauthorized: true,
    };

    await this.attachCertificates(options, cluster, user);
    this.logger.debug(
      `Request options for ${method} request: ${JSON.stringify(options)}`,
    );

    return options;
  }

  /**
   * Attaches SSL certificates and keys to the request options.
   * @param options RequestOptions to modify.
   * @param cluster Cluster configuration.
   * @param user User configuration.
   * @returns {Promise} that resolves when certificates are attached.
   * @throws {ParsingError} if certificates cannot be read or parsed.
   * @throws {NetworkError} if an error occurs while reading certificates.
   * @example Attach certificates to request options:
   * ```typescript
   * await client.attachCertificates(options, cluster, user);
   * ```
   */
  private async attachCertificates(
    options: RequestOptions,
    cluster: ResolvedKubeConfig['cluster'],
    user: ResolvedKubeConfig['user'],
  ): Promise<void> {
    this.logger.debug('Attaching certificates to request options');

    // Attach Client Certificate
    if (user.clientCertificate) {
      this.logger.debug('Adding client certificate from file');
      const pem = await this.fileSystem.readFile(
        user.clientCertificate,
        'utf8',
      );
      options.cert = PemUtils.pemToBuffer(pem, 'CERTIFICATE');
    } else if (user.clientCertificateData) {
      this.logger.debug('Adding client certificate from base64 data');
      options.cert = Buffer.from(user.clientCertificateData, 'base64');
    }

    // Attach Client Key
    if (user.clientKey) {
      this.logger.debug('Adding client key from file');
      const pem = await this.fileSystem.readFile(user.clientKey, 'utf8');
      options.key = PemUtils.pemToBuffer(pem, 'PRIVATE KEY');
    } else if (user.clientKeyData) {
      this.logger.debug('Adding client key from base64 data');
      options.key = Buffer.from(user.clientKeyData, 'base64');
    }

    // Attach Cluster CA
    if (cluster.certificateAuthority) {
      this.logger.debug('Adding cluster CA certificate from file');
      const pem = await this.fileSystem.readFile(
        cluster.certificateAuthority,
        'utf8',
      );
      options.ca = PemUtils.pemToBuffer(pem, 'CERTIFICATE');
    } else if (cluster.certificateAuthorityData) {
      this.logger.debug('Adding cluster CA certificate from base64 data');
      options.ca = Buffer.from(cluster.certificateAuthorityData, 'base64');
    }

    if (!options.ca) {
      this.logger.warn(
        'No CA certificate provided. This is insecure and should not be used in production.',
      );
    }
  }

  /**
   * Makes an HTTPS request to the Kubernetes API.
   * @param method HTTP method.
   * @param path API endpoint path.
   * @param body Request payload.
   * @param parseJson Whether to parse the response as JSON.
   * @returns Parsed response data.
   * @throws {ApiError} if the request fails with a non-2xx status code.
   * @throws {NetworkError} if a network error occurs during the request.
   * @throws {ParsingError} if the response cannot be parsed as JSON.
   * @example
   * ```typescript
   * const response = await client.makeRequest('GET', '/api/v1/pods');
   * ```
   */
  private async makeRequest<T>(
    method: string,
    path: string,
    body?: any,
    parseJson: boolean = true,
  ): Promise<T> {
    return this.executeWithLogging(
      async () => {
        this.logger.debug(`Preparing to make ${method} request to ${path}`);
        const options = await this.getRequestOptions(method, path);
        return new Promise<T>((resolve, reject) => {
          const req = request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
              this.logger.debug(`Received data chunk of size: ${chunk.length}`);
              data += chunk;
            });

            res.on('end', () => {
              this.logger.debug(
                `Response received with status code: ${res.statusCode}`,
              );
              if (
                res.statusCode &&
                res.statusCode >= HttpStatus.OK &&
                res.statusCode < HttpStatus.MULTIPLE_CHOICES
              ) {
                try {
                  if (res.statusCode === HttpStatus.NO_CONTENT) {
                    resolve(undefined as any); // No content
                  } else if (parseJson) {
                    const parsedData = JSON.parse(data);
                    resolve(parsedData);
                  } else {
                    resolve(data as any);
                  }
                } catch (e: any) {
                  this.logger.error(
                    `Failed to parse response JSON: ${e.message}`,
                  );
                  reject(
                    new ParsingError('Failed to parse response JSON.', data),
                  );
                }
              } else {
                const statusCode = res.statusCode as HttpStatus;
                this.logger.error(
                  `Request failed with status code: ${statusCode}`,
                );
                reject(
                  new ApiError(
                    statusCode,
                    `Request failed with status code ${statusCode}`,
                    data,
                  ),
                );
              }
            });
          });

          req.on('error', (err) => {
            this.logger.error(`Request error: ${err.message}`);
            reject(
              new NetworkError(
                'Network error occurred during the request.',
                err,
              ),
            );
          });

          if (body) {
            this.logger.debug(`Request body: ${JSON.stringify(body)}`);
            req.write(JSON.stringify(body));
          }

          req.end();
        });
      },
      `Making ${method} request to ${path}`,
      `Failed to make ${method} request to ${path}`,
      method,
      path,
    );
  }

  /**
   * Fetches a specific Kubernetes resource.
   * @param apiVersion API version of the resource.
   * @param kind Kind of the resource.
   * @param name Name of the resource.
   * @param namespace Namespace of the resource.
   * @returns The requested resource.
   * @throws {ClientError} if the resource cannot be fetched.
   * @example Fetch a specific pod:
   * ```typescript
   * const pod = await client.getResource('v1', 'Pod', 'my-pod', 'default');
   * ```
   */
  public async getResource<T extends KubernetesResource>(
    apiVersion: string,
    kind: string,
    name: string,
    namespace?: string,
  ): Promise<T> {
    this.logger.debug(
      `Fetching resource of kind: ${kind}, name: ${name}, namespace: ${namespace}`,
    );
    const resourcePath = this.getResourcePath(
      apiVersion,
      kind,
      name,
      namespace,
    );
    return this.executeWithLogging<T>(
      () => this.makeRequest<T>('GET', resourcePath),
      `Fetching resource: ${kind} with name: ${name} in namespace: ${namespace}`,
      `Failed to fetch resource ${kind} with name ${name}`,
      'getResource',
      kind,
      namespace,
    );
  }

  /**
   * Lists multiple Kubernetes resources based on the provided filters.
   * @param apiVersion API version of the resources.
   * @param kind Kind of the resources.
   * @param namespace Namespace to filter resources.
   * @param labelSelector Label selector to filter resources.
   * @param fieldSelector Field selector to filter resources.
   * @returns {Array} of listed resources.
   * @throws {ClientError} if the resources cannot be listed.
   * @example List all pods in the 'default' namespace:
   * ```typescript
   * const pods = await client.listResources('v1', 'Pod', 'default');
   * ```
   */
  public async listResources<T extends KubernetesResource>(
    apiVersion: string,
    kind: string,
    namespace?: string,
    labelSelector?: string,
    fieldSelector?: string,
  ): Promise<T[]> {
    this.logger.debug(
      `Listing resources of kind: ${kind}, namespace: ${namespace}`,
    );
    let resourcePath = this.getResourcePath(apiVersion, kind, '', namespace);
    const queryParams: string[] = [];

    if (labelSelector) {
      queryParams.push(`labelSelector=${encodeURIComponent(labelSelector)}`);
    }
    if (fieldSelector) {
      queryParams.push(`fieldSelector=${encodeURIComponent(fieldSelector)}`);
    }
    if (queryParams.length > 0) {
      resourcePath += `?${queryParams.join('&')}`;
    }

    return this.executeWithLogging(
      () =>
        this.makeRequest<{ items: T[] }>('GET', resourcePath).then(
          (response) => response.items,
        ),
      `Listing resources of kind: ${kind} in namespace: ${namespace}`,
      `Failed to list resources of kind ${kind}`,
      'listResources',
      kind,
      namespace,
    );
  }

  /**
   * Creates a new Kubernetes resource.
   * @param resource The resource to create.
   * @param namespace Namespace to create the resource in.
   * @returns The created resource.
   * @throws {ClientError} if the resource cannot be created.
   * @example Create a new pod in the 'default' namespace:
   * ```typescript
   * const pod = await client.createResource(podResource, 'default');
   * ```
   */
  public async createResource<T extends KubernetesResource>(
    resource: T,
    namespace?: string,
  ): Promise<T> {
    const apiVersion = resource.apiVersion;
    const kind = resource.kind;
    const name = resource.metadata.name;
    this.logger.debug(
      `Creating resource of kind: ${kind}, name: ${name}, namespace: ${namespace}`,
    );
    const resourcePath = this.getResourcePath(apiVersion, kind, '', namespace);

    return this.executeWithLogging(
      () => this.makeRequest<T>('POST', resourcePath, resource),
      `Creating resource: ${kind} with name: ${name} in namespace: ${namespace}`,
      `Failed to create resource ${kind} with name ${name}`,
      'createResource',
      kind,
      namespace,
    );
  }

  /**
   * Updates an existing Kubernetes resource.
   * @param resource The resource to update.
   * @param namespace Namespace of the resource.
   * @returns The updated resource.
   * @throws {ClientError} if the resource cannot be updated.
   * @example Update an existing pod in the 'default' namespace:
   * ```typescript
   * const updatedPod = await client.updateResource(podResource, 'default');
   * ```
   */
  public async updateResource<T extends KubernetesResource>(
    resource: T,
    namespace?: string,
  ): Promise<T> {
    const apiVersion = resource.apiVersion;
    const kind = resource.kind;
    const name = resource.metadata.name;
    this.logger.debug(
      `Updating resource of kind: ${kind}, name: ${name}, namespace: ${namespace}`,
    );
    const resourcePath = this.getResourcePath(
      apiVersion,
      kind,
      name,
      namespace,
    );

    return this.executeWithLogging(
      () => this.makeRequest<T>('PUT', resourcePath, resource),
      `Updating resource: ${kind} with name: ${name} in namespace: ${namespace}`,
      `Failed to update resource ${kind} with name ${name}`,
      'updateResource',
      kind,
      namespace,
    );
  }

  /**
   * Deletes a Kubernetes resource.
   * @param apiVersion API version of the resource.
   * @param kind Kind of the resource.
   * @param name Name of the resource.
   * @param namespace Namespace of the resource.
   * @throws {ClientError} if the resource cannot be deleted.
   * @example Delete a pod in the 'default' namespace:
   * ```typescript
   * await client.deleteResource('v1', 'Pod', 'my-pod', 'default');
   * ```
   */
  public async deleteResource(
    apiVersion: string,
    kind: string,
    name: string,
    namespace?: string,
  ): Promise<void> {
    this.logger.debug(
      `Deleting resource of kind: ${kind}, name: ${name}, namespace: ${namespace}`,
    );
    const resourcePath = this.getResourcePath(
      apiVersion,
      kind,
      name,
      namespace,
    );
    await this.executeWithLogging(
      () => this.makeRequest<void>('DELETE', resourcePath, undefined, false), // parseJson=false
      `Deleting resource: ${kind} with name: ${name} in namespace: ${namespace}`,
      `Failed to delete resource ${kind} with name ${name}`,
      'deleteResource',
      kind,
      namespace,
    );
  }

  /**
   * Fetches logs for a specific pod.
   * @param name Name of the pod.
   * @param namespace Namespace of the pod.
   * @param container Optional container name within the pod.
   * @returns Logs as a string.
   * @throws {ClientError} if the logs cannot be fetched.
   * @example Fetch logs for a pod:
   * ```typescript
   * const logs = await client.getPodLogs('my-pod', 'default');
   * ```
   */
  public async getPodLogs(
    name: string,
    namespace: string,
    container?: string,
  ): Promise<string> {
    this.logger.debug(
      `Fetching logs for pod: ${name}, namespace: ${namespace}, container: ${container}`,
    );
    let path = `/api/v1/namespaces/${namespace}/pods/${name}/log`;
    if (container) {
      path += `?container=${encodeURIComponent(container)}`;
    }
    return this.executeWithLogging(
      () => this.makeRequest<string>('GET', path, undefined, false), // parseJson=false
      `Fetching logs for pod: ${name} in namespace: ${namespace}`,
      `Failed to fetch logs for pod ${name}`,
      'getPodLogs',
      'Pod',
      namespace,
    );
  }

  /**
   * Watches a Kubernetes resource for changes.
   * @param apiVersion API version of the resource.
   * @param kind Kind of the resource.
   * @param namespace Namespace of the resource.
   * @param labelSelector Optional label selector.
   * @param fieldSelector Optional field selector.
   * @returns Async generator yielding watch events.
   * @throws {ClientError} if the resource cannot be watched.
   * @example Watch for changes to pods in the 'default' namespace:
   * ```typescript
   * for await (const event of client.watchResource('v1', 'Pod', 'default')) {
   *  console.log(event);
   * }
   * ```
   */
  public async *watchResource<T>(
    apiVersion: string,
    kind: string,
    namespace: string,
    labelSelector?: string,
    fieldSelector?: string,
  ): AsyncGenerator<WatchEvent<T>> {
    this.logger.debug(
      `Watching resource of kind: ${kind}, namespace: ${namespace}`,
    );
    const resourcePath = this.getResourcePath(apiVersion, kind, '', namespace);
    const queryParams: string[] = ['watch=true'];
    if (labelSelector) {
      queryParams.push(`labelSelector=${encodeURIComponent(labelSelector)}`);
    }
    if (fieldSelector) {
      queryParams.push(`fieldSelector=${encodeURIComponent(fieldSelector)}`);
    }
    const path = `${resourcePath}?${queryParams.join('&')}`;

    const options = await this.getRequestOptions('GET', path);

    const logger = this.logger;
    const stream = new Readable({
      read() {
        const req = request(options, (res) => {
          res.on('data', (chunk) => this.push(chunk));
          res.on('end', () => this.push(null));
        });

        req.on('error', (err) => {
          logger.error(
            `Error occurred while watching resource: ${err.message}`,
          );
          this.destroy(new NetworkError('Error in watch stream.', err));
        });
        req.end();
      },
    });

    for await (const chunk of stream) {
      const data = chunk.toString();
      for (const line of data.split('\n')) {
        if (line.trim()) {
          try {
            yield JSON.parse(line) as WatchEvent<T>;
          } catch (e) {
            this.logger.error(`Failed to parse watch event JSON: ${e.message}`);
            throw new Error('Failed to parse watch event JSON');
          }
        }
      }
    }
  }

  /**
   * Generates the API path for a given resource.
   * @param apiVersion API version of the resource.
   * @param kind Kind of the resource.
   * @param name Name of the resource.
   * @param namespace Namespace of the resource.
   * @returns API endpoint path.
   * @example Generate a resource path:
   * ```typescript
   * const path = client.getResourcePath('v1', 'Pod', 'my-pod', 'default');
   * ```
   */
  private getResourcePath(
    apiVersion: string,
    kind: string,
    name: string,
    namespace?: string,
  ): string {
    this.logger.debug(
      `Generating resource path for apiVersion: ${apiVersion}, kind: ${kind}, name: ${name}, namespace: ${namespace}`,
    );
    const [apiGroup, version] = apiVersion.includes('/')
      ? apiVersion.split('/')
      : ['', apiVersion];

    const isNamespaced = namespace !== undefined && namespace !== '';

    // Convert kind to lowercase plural form (simplified)
    const resourceName = this.kindToResourceName(kind);

    let path = '';

    if (apiGroup) {
      path += `/apis/${apiGroup}/${version}`;
    } else {
      path += `/api/${version}`;
    }

    if (isNamespaced) {
      path += `/namespaces/${namespace}`;
    }

    path += `/${resourceName}`;

    if (name) {
      path += `/${name}`;
    }

    this.logger.debug(`Generated resource path: ${path}`);
    return path;
  }

  /**
   * Converts a Kubernetes kind to its corresponding resource name.
   * @param kind Kind of the resource.
   * @returns Pluralized, lowercase resource name.
   * @example Convert a kind to a resource name:
   * ```typescript
   * const resourceName = client.kindToResourceName('Pod');
   * ```
   */
  private kindToResourceName(kind: string): string {
    const kindToResourceNameMap: { [kind: string]: string } =
      KindToResourceNameMap;

    const resourceName = kindToResourceNameMap[kind];
    if (resourceName) {
      return resourceName;
    } else {
      this.logger.debug(
        `Kind to resource name mapping not found for kind: ${kind}, using pluralizeKind instead.`,
      );
      return this.pluralizeKind(kind);
    }
  }

  /**
   * Pluralizes a Kubernetes kind that isn't explicitly mapped.
   * @param kind Kind of the resource.
   * @returns Pluralized, lowercase resource name.
   * @example Pluralize a kind:
   * ```typescript
   * const pluralizedKind = client.pluralizeKind('Pod');
   * ```
   * @remarks This is a simplified pluralization method and may not cover all cases.
   */
  private pluralizeKind(kind: string): string {
    const lowerKind = kind.toLowerCase();

    if (
      lowerKind.endsWith('s') ||
      lowerKind.endsWith('x') ||
      lowerKind.endsWith('z') ||
      lowerKind.endsWith('ch') ||
      lowerKind.endsWith('sh')
    ) {
      return lowerKind + 'es';
    } else if (lowerKind.endsWith('y') && !/[aeiou]y$/.test(lowerKind)) {
      return lowerKind.slice(0, -1) + 'ies';
    } else {
      return lowerKind + 's';
    }
  }

  /**
   * Handles errors by logging appropriate messages based on error type and rethrowing a standardized ClientError.
   * @param error The caught error to handle.
   * @param method The name of the method where the error occurred.
   * @param errorMessage The custom error message to log.
   * @param resourceName The name of the resource involved in the error.
   * @param namespace The namespace of the resource, if applicable.
   * @throws {ClientError} with the standardized error message.
   * @remarks This method is used to standardize error handling and logging across the client.
   * @example Handle an error and rethrow a ClientError:
   * ```typescript
   * try {
   *  // Code that may throw an error
   * } catch (error) {
   * this.handleError(error, 'myMethod', 'Failed to perform action', 'MyResource', 'default');
   * }
   * ```
   */
  private handleError(
    error: any,
    method: string,
    errorMessage: string,
    resourceName: string,
    namespace?: string,
  ): never {
    // Log error details based on the type of error
    if (error instanceof ApiError) {
      this.logger.error(
        `[${method}] ${errorMessage}: ${error.message} (Status Code: ${error.statusCode})`,
        {
          responseBody: error.responseBody,
        },
      );
      throw error; // Rethrow the original ApiError to preserve its type
    } else if (error instanceof NetworkError) {
      this.logger.error(`[${method}] ${errorMessage}: ${error.message}`, {
        originalError: error.originalError,
      });
      throw error; // Rethrow the original NetworkError
    } else if (error instanceof ParsingError) {
      this.logger.error(`[${method}] ${errorMessage}: ${error.message}`, {
        responseBody: error.responseBody,
      });
      throw error; // Rethrow the original ParsingError
    } else {
      this.logger.error(`[${method}] ${errorMessage}: ${error.message}`, error);
      throw new ClientError(error.message, method, resourceName, namespace);
    }
  }

  /**
   * Executes an asynchronous action with logging for success and error scenarios.
   * @param action The asynchronous action to execute.
   * @param successMessage Message to log upon successful execution.
   * @param errorMessage Message to log upon failure.
   * @param method The method name where the action is being executed.
   * @param resourceName The name of the resource involved.
   * @param namespace The namespace of the resource, if applicable.
   * @returns The result of the action.
   * @throws {ClientError} if the action fails.
   * @remarks This method is used to standardize logging and error handling across the client.
   * @example Execute an action with logging:
   * ```typescript
   * const result = await this.executeWithLogging(
   * () => this.makeRequest('GET', '/api/v1/pods'),
   * 'Successfully fetched pods',
   * 'Failed to fetch pods',
   * 'getPods',
   * 'Pod',
   * 'default',
   * );
   * ```
   */
  private async executeWithLogging<T>(
    action: () => Promise<T>,
    successMessage: string,
    errorMessage: string,
    method: string,
    resourceName: string,
    namespace?: string,
  ): Promise<T> {
    try {
      this.logger.info(`[${method}] ${successMessage}`);
      const result = await action();
      this.logger.info(`[${method}] Success: ${successMessage}`);
      return result;
    } catch (error: any) {
      this.handleError(error, method, errorMessage, resourceName, namespace);
    }
  }
}
