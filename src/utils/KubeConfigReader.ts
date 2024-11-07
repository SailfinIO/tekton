// src/utils/KubeConfigReader.ts

import { promises as fs } from 'fs';
import { ResolvedKubeConfig } from '../models';
import { YamlParser } from './YamlParser';
import { Logger } from './Logger';
import * as path from 'path';

export class KubeConfigReader {
  private kubeConfigPath: string;
  readonly logger = new Logger(KubeConfigReader.name);

  constructor(kubeConfigPath?: string) {
    this.kubeConfigPath =
      kubeConfigPath ||
      path.join(process.env.HOME || '/root', '.kube', 'config');
  }

  private mapKeys(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.mapKeys(item));
    } else if (obj !== null && typeof obj === 'object') {
      const mapped: any = {};
      for (const key of Object.keys(obj)) {
        const newKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        mapped[newKey] = this.mapKeys(obj[key]);
      }
      return mapped;
    } else {
      return obj;
    }
  }

  public async getKubeConfig(): Promise<ResolvedKubeConfig | null> {
    try {
      const fileContent = await fs.readFile(this.kubeConfigPath, 'utf8');
      const rawConfig = YamlParser.parse(fileContent);
      const config: any = this.mapKeys(rawConfig); // Adjusted to 'any' for flexibility

      const currentContextName = config.currentContext;
      if (!currentContextName) {
        this.logger.error(`No currentContext is set in kubeconfig.`);
        throw new Error(`No currentContext is set in kubeconfig.`);
      }

      const context = config.contexts.find(
        (ctx: any) => ctx.name === currentContextName,
      )?.context;

      if (!context) {
        this.logger.error(
          `Context '${currentContextName}' not found in kubeconfig.`,
        );
        throw new Error(
          `Context '${currentContextName}' not found in kubeconfig.`,
        );
      }

      const clusterEntry = config.clusters.find(
        (c: any) => c.name === context.cluster,
      );
      const cluster = clusterEntry?.cluster;

      if (!cluster) {
        this.logger.error(
          `Cluster '${context.cluster}' not found in kubeconfig.`,
        );
        throw new Error(
          `Cluster '${context.cluster}' not found in kubeconfig.`,
        );
      }

      const userEntry = config.users.find((u: any) => u.name === context.user);
      const user = userEntry?.user;

      if (!user) {
        this.logger.error(`User '${context.user}' not found in kubeconfig.`);
        throw new Error(`User '${context.user}' not found in kubeconfig.`);
      }

      return {
        cluster,
        user,
      };
    } catch (error: any) {
      this.logger.error(`Failed to read kubeconfig: ${error.message}`);
      return null;
    }
  }

  public async getInClusterConfig(): Promise<ResolvedKubeConfig> {
    const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
    const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
    const namespacePath =
      '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

    // Helper function to check file existence
    const fileExists = async (filePath: string): Promise<boolean> => {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    };

    // Helper function to read file content safely
    const safeReadFile = async (
      filePath: string,
      encoding: BufferEncoding = 'utf8',
    ): Promise<string | Buffer> => {
      try {
        const content = await fs.readFile(filePath, encoding);
        return content;
      } catch (error: any) {
        this.logger.error(
          `Failed to read file at ${filePath}: ${error.message}`,
        );
        throw new Error(`Failed to read file at ${filePath}: ${error.message}`);
      }
    };

    // Detect if running in a Kubernetes cluster
    const isInCluster = async (): Promise<boolean> => {
      const tokenExists = await fileExists(tokenPath);
      const caExists = await fileExists(caPath);
      const namespaceExists = await fileExists(namespacePath);
      const serviceHost = process.env.KUBERNETES_SERVICE_HOST;
      const servicePort = process.env.KUBERNETES_SERVICE_PORT;

      return (
        tokenExists &&
        caExists &&
        namespaceExists &&
        !!serviceHost &&
        !!servicePort
      );
    };

    try {
      const inCluster = await isInCluster();

      if (!inCluster) {
        this.logger.error('Not running inside a Kubernetes cluster.');
        throw new Error('In-cluster configuration is not available.');
      }

      const [token, ca, namespace] = await Promise.all([
        safeReadFile(tokenPath, 'utf8'),
        safeReadFile(caPath, null),
        safeReadFile(namespacePath, 'utf8'),
      ]);

      // Validate token and CA
      if (!token || typeof token !== 'string') {
        this.logger.error('Service account token is missing or invalid.');
        throw new Error('Service account token is missing or invalid.');
      }

      if (!ca || !(ca instanceof Buffer)) {
        this.logger.error('CA certificate is missing or invalid.');
        throw new Error('CA certificate is missing or invalid.');
      }

      // Optionally, validate namespace
      if (!namespace || typeof namespace !== 'string') {
        this.logger.warn('Namespace is missing or invalid.');
      }

      if (
        !process.env.KUBERNETES_SERVICE_HOST ||
        !process.env.KUBERNETES_SERVICE_PORT
      ) {
        this.logger.error(
          'KUBERNETES_SERVICE_HOST or KUBERNETES_SERVICE_PORT environment variables are not set.',
        );
        throw new Error(
          'KUBERNETES_SERVICE_HOST or KUBERNETES_SERVICE_PORT environment variables are not set.',
        );
      }

      const server = `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`;

      return {
        cluster: {
          server,
          certificateAuthorityData: ca.toString('base64'),
        },
        user: {
          token: token.trim(),
        },
        // Optionally include namespace if needed
        // namespace: namespace.trim(),
      };
    } catch (error: any) {
      this.logger.error('Failed to load in-cluster configuration', error);
      throw new Error(
        `In-cluster configuration loading failed: ${error.message}`,
      );
    }
  }
}
