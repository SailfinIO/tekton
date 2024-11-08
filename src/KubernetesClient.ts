// src/KubernetesClient.ts

import { request, RequestOptions } from 'https';
import { URL } from 'url';
import { ResolvedKubeConfig, KubernetesResource, WatchEvent } from './models';
import { KubeConfigReader } from './utils';
import { Logger } from './utils';
import { readFileSync } from 'fs';
import { ApiError } from './errors';
import { IKubernetesClient, KubernetesClientOptions } from './interfaces';
import { Readable } from 'stream';
import { LogLevel } from './enums';

export class KubernetesClient implements IKubernetesClient {
  private kubeConfig: ResolvedKubeConfig;
  private readonly logger = new Logger(KubernetesClient.name);

  private constructor(
    kubeConfig: ResolvedKubeConfig,
    logLevel: LogLevel = LogLevel.INFO,
  ) {
    this.kubeConfig = kubeConfig;
    this.logger = new Logger(KubernetesClient.name, logLevel);
    this.logger.debug(
      'KubernetesClient initialized with provided kubeConfig and logLevel',
    );
  }

  /**
   * Static factory method for creating an instance of KubernetesClient.
   * Attempts to load kubeconfig from the default path if no path is provided.
   * Falls back to in-cluster config if loading from file fails.
   * @param kubeConfigPath Optional path to kubeconfig file.
   */
  public static async create(
    options?: KubernetesClientOptions,
  ): Promise<KubernetesClient> {
    const { kubeConfigPath, logLevel } = options || {};
    const reader = new KubeConfigReader(kubeConfigPath);
    let kubeConfig: ResolvedKubeConfig | null = null;

    if (kubeConfigPath) {
      reader.logger.info(
        `Attempting to load kubeconfig from path: ${kubeConfigPath}`,
      );
      // Attempt to load from the specified kubeConfigPath
      kubeConfig = await reader.getKubeConfig();
      if (!kubeConfig) {
        reader.logger.error(
          `Failed to load kubeconfig from path: ${kubeConfigPath}`,
        );
        throw new Error(
          `Failed to load kubeconfig from path: ${kubeConfigPath}`,
        );
      }
      reader.logger.info(`Loaded kube config from path: ${kubeConfigPath}`);
    } else {
      reader.logger.info('Attempting to load kubeconfig from default path.');
      // Attempt to load from the default kubeconfig path
      kubeConfig = await reader.getKubeConfig();
      if (kubeConfig) {
        reader.logger.info('Loaded kube config from default path.');
      } else {
        reader.logger.warn(
          'Default kube config not found. Attempting to load in-cluster config.',
        );
        // Fallback to in-cluster configuration
        kubeConfig = await reader.getInClusterConfig();
        reader.logger.info('Loaded in-cluster kube config.');
      }
    }

    return new KubernetesClient(kubeConfig, logLevel);
  }

  private getRequestOptions(method: string, path: string): RequestOptions {
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

    this.attachCertificates(options, cluster, user);
    this.logger.debug(
      `Request options for ${method} request: ${JSON.stringify(options)}`,
    );

    return options;
  }

  private attachCertificates(
    options: RequestOptions,
    cluster: ResolvedKubeConfig['cluster'],
    user: ResolvedKubeConfig['user'],
  ): void {
    this.logger.debug('Attaching certificates to request options');
    if (user.clientCertificate) {
      this.logger.debug('Adding client certificate from file');
      options.cert = readFileSync(user.clientCertificate);
    } else if (user.clientCertificateData) {
      this.logger.debug('Adding client certificate from base64 data');
      options.cert = Buffer.from(user.clientCertificateData, 'base64');
    }

    if (user.clientKey) {
      this.logger.debug('Adding client key from file');
      options.key = readFileSync(user.clientKey);
    } else if (user.clientKeyData) {
      this.logger.debug('Adding client key from base64 data');
      options.key = Buffer.from(user.clientKeyData, 'base64');
    }

    if (cluster.certificateAuthority) {
      this.logger.debug('Adding cluster CA certificate from file');
      options.ca = readFileSync(cluster.certificateAuthority);
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

  private async makeRequest<T>(
    method: string,
    path: string,
    body?: any,
  ): Promise<T> {
    return this.executeWithLogging(
      () => {
        this.logger.debug(`Preparing to make ${method} request to ${path}`);
        const options = this.getRequestOptions(method, path);
        return new Promise((resolve, reject) => {
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
                res.statusCode >= 200 &&
                res.statusCode < 300
              ) {
                try {
                  const parsedData = JSON.parse(data);
                  resolve(parsedData);
                } catch (e) {
                  this.logger.error(
                    `Failed to parse response JSON: ${e.message}`,
                  );
                  reject(
                    new Error(`Failed to parse response JSON: ${e.message}`),
                  );
                }
              } else {
                this.logger.error(
                  `Request failed with status code: ${res.statusCode}`,
                );
                reject(
                  new ApiError(
                    res.statusCode || 500,
                    `Request failed with status code ${res.statusCode}`,
                    data,
                  ),
                );
              }
            });
          });

          req.on('error', (err) => {
            this.logger.error(`Request error: ${err.message}`);
            reject(err);
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

  public async createResource<T extends KubernetesResource>(
    resource: T,
    namespace?: string,
  ): Promise<T> {
    const apiVersion = resource.apiVersion;
    const kind = resource.kind;
    this.logger.debug(
      `Creating resource of kind: ${kind}, name: ${resource.metadata.name}, namespace: ${namespace}`,
    );
    const resourcePath = this.getResourcePath(apiVersion, kind, '', namespace);

    return this.executeWithLogging(
      () => this.makeRequest<T>('POST', resourcePath, resource),
      `Creating resource: ${kind} with name: ${resource.metadata.name} in namespace: ${namespace}`,
      `Failed to create resource ${kind} with name ${resource.metadata.name}`,
      'createResource',
      kind,
      namespace,
    );
  }

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
    return this.executeWithLogging(
      () => this.makeRequest<void>('DELETE', resourcePath),
      `Deleting resource: ${kind} with name: ${name} in namespace: ${namespace}`,
      `Failed to delete resource ${kind} with name ${name}`,
      'deleteResource',
      kind,
      namespace,
    );
  }

  // Helper methods

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
      () => this.makeRequest<string>('GET', path),
      `Fetching logs for pod: ${name} in namespace: ${namespace}`,
      `Failed to fetch logs for pod ${name}`,
      'getPodLogs',
      'Pod',
      namespace,
    );
  }

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

    const options = this.getRequestOptions('GET', path);

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
          this.destroy(err);
        });
        req.end();
      },
    });

    for await (const chunk of stream) {
      const data = chunk.toString();
      this.logger.debug(`Received watch event chunk of size: ${data.length}`);
      for (const line of data.split('\n')) {
        if (line.trim()) {
          yield JSON.parse(line) as WatchEvent<T>;
        }
      }
    }
  }

  private kindToResourceName(kind: string): string {
    const kindToResourceNameMap: { [kind: string]: string } = {
      Pod: 'pods',
      Service: 'services',
      Deployment: 'deployments',
      ReplicaSet: 'replicasets',
      ConfigMap: 'configmaps',
      Secret: 'secrets',
      Ingress: 'ingresses',
      Policy: 'policies',
      Status: 'status',
      Endpoint: 'endpoints',
      Node: 'nodes',
      Namespace: 'namespaces',
      Job: 'jobs',
      CronJob: 'cronjobs',
      PersistentVolume: 'persistentvolumes',
      PersistentVolumeClaim: 'persistentvolumeclaims',
      StatefulSet: 'statefulsets',
      DaemonSet: 'daemonsets',
      HorizontalPodAutoscaler: 'horizontalpodautoscalers',
      ServiceAccount: 'serviceaccounts',
      ClusterRole: 'clusterroles',
      ClusterRoleBinding: 'clusterrolebindings',
      Role: 'roles',
      RoleBinding: 'rolebindings',
      NetworkPolicy: 'networkpolicies',
      // Tekton Kinds
      Task: 'tasks',
      TaskRun: 'taskruns',
      Pipeline: 'pipelines',
      PipelineRun: 'pipelineruns',
      ClusterTask: 'clustertasks',
    };

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
      if (error instanceof ApiError) {
        this.logger.error(
          `[${method}] ${errorMessage}: ${error.message} (Status Code: ${error.statusCode})`,
          {
            responseBody: error.responseBody,
          },
        );
      } else {
        this.logger.error(
          `[${method}] ${errorMessage}: ${error.message}`,
          error,
        );
      }
      throw error;
    }
  }
}
