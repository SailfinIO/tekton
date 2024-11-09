// src/utils/KubeConfigReader.ts

import { ResolvedKubeConfig } from '../models';
import { YamlParser } from './YamlParser';
import { Logger } from './Logger';
import * as path from 'path';
import {
  ConfigFileNotFoundError,
  InvalidConfigError,
  ParsingError,
} from '../errors';
import { IFileSystem } from '../interfaces';
import { ILogger } from '../interfaces/ILogger';
import { FileSystem } from './FileSystem';

export class KubeConfigReader {
  private kubeConfigPath: string;
  public static logger: ILogger;
  private fileSystem: IFileSystem;
  private yamlParser: typeof YamlParser;

  constructor(
    kubeConfigPath?: string,
    fsInstance: IFileSystem = new FileSystem(),
    yamlParser: typeof YamlParser = YamlParser,
    logger: Logger = new Logger(KubeConfigReader.name),
  ) {
    this.kubeConfigPath =
      kubeConfigPath ||
      path.join(process.env.HOME || '/root', '.kube', 'config');
    this.fileSystem = fsInstance;
    this.yamlParser = yamlParser;
    KubeConfigReader.logger = logger;
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

  public async getKubeConfig(): Promise<ResolvedKubeConfig> {
    try {
      const fileContent = await this.fileSystem.readFile(
        this.kubeConfigPath,
        'utf8',
      );
      const rawConfig = this.yamlParser.parse(fileContent);
      const config: any = this.mapKeys(rawConfig);

      // Validate presence of required fields
      if (!config.currentContext) {
        KubeConfigReader.logger.error(
          'No currentContext is set in kubeconfig.',
        );
        throw new InvalidConfigError('No currentContext is set in kubeconfig.');
      }

      const currentContextName = config.currentContext;
      if (!currentContextName) {
        KubeConfigReader.logger.error(
          `No currentContext is set in kubeconfig.`,
        );
        return null;
      }

      const context = config.contexts.find(
        (ctx: any) => ctx.name === currentContextName,
      )?.context;

      if (!context) {
        KubeConfigReader.logger.error(
          `Context '${currentContextName}' not found in kubeconfig.`,
        );
        return null;
      }

      const clusterEntry = config.clusters.find(
        (c: any) => c.name === context.cluster,
      );
      const cluster = clusterEntry?.cluster;

      if (!cluster) {
        KubeConfigReader.logger.error(
          `Cluster '${context.cluster}' not found in kubeconfig.`,
        );
        return null;
      }

      const userEntry = config.users.find((u: any) => u.name === context.user);
      const user = userEntry?.user;

      if (!user) {
        KubeConfigReader.logger.error(
          `User '${context.user}' not found in kubeconfig.`,
        );
        return null;
      }

      return {
        cluster,
        user,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new ConfigFileNotFoundError(this.kubeConfigPath);
      } else if (error instanceof SyntaxError) {
        throw new ParsingError(
          'Failed to parse kubeconfig YAML.',
          error.message,
        );
      } else if (error instanceof InvalidConfigError) {
        throw error; // Re-throw specific config errors
      } else {
        KubeConfigReader.logger.error(`Unexpected error: ${error.message}`);
        throw new Error(`Failed to read kubeconfig: ${error.message}`);
      }
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
        await this.fileSystem.access(filePath);
        return true;
      } catch {
        return false;
      }
    };

    // Helper function to read file content safely
    const safeReadFile = async (
      filePath: string,
      encoding?: BufferEncoding,
    ): Promise<string | Buffer> => {
      try {
        const content = await this.fileSystem.readFile(filePath, encoding);
        return content;
      } catch (error: any) {
        KubeConfigReader.logger.error(
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
        KubeConfigReader.logger.error(
          'Not running inside a Kubernetes cluster.',
        );
        if (
          !process.env.KUBERNETES_SERVICE_HOST ||
          !process.env.KUBERNETES_SERVICE_PORT
        ) {
          throw new Error(
            'KUBERNETES_SERVICE_HOST or KUBERNETES_SERVICE_PORT environment variables are not set.',
          );
        }
        throw new Error('In-cluster configuration is not available.');
      }

      const [token, ca, namespace] = await Promise.all([
        safeReadFile(tokenPath, 'utf8'), // Read as string
        safeReadFile(caPath), // Read as Buffer (no encoding)
        safeReadFile(namespacePath, 'utf8'), // Read as string
      ]);
      // Validate token and CA
      if (!token || typeof token !== 'string' || token.trim() === '') {
        KubeConfigReader.logger.error(
          'Service account token is missing or invalid.',
        );
        throw new Error('Service account token is missing or invalid.');
      }

      if (!ca || !(ca instanceof Buffer)) {
        KubeConfigReader.logger.error('CA certificate is missing or invalid.');
        throw new Error(
          'In-cluster configuration loading failed: CA certificate is missing or invalid.',
        );
      }

      if (ca.length === 0) {
        KubeConfigReader.logger.error('CA certificate data is empty.');
        throw new Error(
          'In-cluster configuration loading failed: CA certificate data is empty.',
        );
      }

      // Optionally, validate namespace
      if (!namespace || typeof namespace !== 'string') {
        KubeConfigReader.logger.warn('Namespace is missing or invalid.');
      }

      if (
        !process.env.KUBERNETES_SERVICE_HOST ||
        !process.env.KUBERNETES_SERVICE_PORT
      ) {
        KubeConfigReader.logger.error(
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
      };
    } catch (error: any) {
      KubeConfigReader.logger.error(
        'Failed to load in-cluster configuration',
        error,
      );
      throw new Error(
        `In-cluster configuration loading failed: ${error.message}`,
      );
    }
  }
}
