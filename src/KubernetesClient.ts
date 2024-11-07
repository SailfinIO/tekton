// src/utils/KubernetesClient.ts

import { request, RequestOptions } from 'https';
import { URL } from 'url';
import { ResolvedKubeConfig, KubernetesResource, WatchEvent } from './models';
import { KubeConfigReader } from './utils/KubeConfigReader';
import { Logger } from './utils/Logger';
import { readFileSync } from 'fs';
import { ApiError } from './errors';
import { IKubernetesClient } from './interfaces';
import { Readable } from 'stream';

export class KubernetesClient implements IKubernetesClient {
  private kubeConfig: ResolvedKubeConfig;
  private readonly logger = new Logger(KubernetesClient.name);

  constructor(kubeConfigPath?: string) {
    const reader = new KubeConfigReader(kubeConfigPath);
    this.kubeConfig = reader.getKubeConfig();
  }

  private getRequestOptions(method: string, path: string): RequestOptions {
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

    return options;
  }

  private attachCertificates(
    options: RequestOptions,
    cluster: ResolvedKubeConfig['cluster'],
    user: ResolvedKubeConfig['user'],
  ): void {
    if (user.clientCertificate) {
      options.cert = readFileSync(user.clientCertificate);
    } else if (user.clientCertificateData) {
      options.cert = Buffer.from(user.clientCertificateData, 'base64');
    }

    if (user.clientKey) {
      options.key = readFileSync(user.clientKey);
    } else if (user.clientKeyData) {
      options.key = Buffer.from(user.clientKeyData, 'base64');
    }

    if (cluster.certificateAuthority) {
      options.ca = readFileSync(cluster.certificateAuthority);
    } else if (cluster.certificateAuthorityData) {
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
        const options = this.getRequestOptions(method, path);
        return new Promise((resolve, reject) => {
          const req = request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              if (
                res.statusCode &&
                res.statusCode >= 200 &&
                res.statusCode < 300
              ) {
                try {
                  const parsedData = JSON.parse(data);
                  resolve(parsedData);
                } catch (e) {
                  reject(
                    new Error(`Failed to parse response JSON: ${e.message}`),
                  );
                }
              } else {
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

          req.on('error', (err) => reject(err));

          if (body) {
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

    return path;
  }

  public async getPodLogs(
    name: string,
    namespace: string,
    container?: string,
  ): Promise<string> {
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

    const stream = new Readable({
      read() {
        const req = request(options, (res) => {
          res.on('data', (chunk) => this.push(chunk));
          res.on('end', () => this.push(null));
        });

        req.on('error', (err) => this.destroy(err));
        req.end();
      },
    });

    for await (const chunk of stream) {
      const data = chunk.toString();
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
