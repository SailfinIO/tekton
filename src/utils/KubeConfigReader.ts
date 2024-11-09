// src/utils/KubeConfigReader.ts

import { ResolvedKubeConfig } from '../models';
import { YamlParser } from './YamlParser';
import { ILogger, IFileSystem } from '../interfaces';
import { FileSystem } from './FileSystem';
import { PemUtils } from './PemUtils';
import {
  ConfigFileNotFoundError,
  InvalidConfigError,
  ParsingError,
  KubeConfigError,
  NotInClusterError,
} from '../errors';
import * as path from 'path';
import { Logger } from './Logger';

export class KubeConfigReader {
  private readonly kubeConfigPath: string;
  private readonly fileSystem: IFileSystem;
  private readonly yamlParser: typeof YamlParser;
  protected readonly logger: ILogger;

  constructor(
    kubeConfigPath?: string,
    fsInstance?: IFileSystem,
    yamlParser: typeof YamlParser = YamlParser,
    logger: ILogger = new Logger(KubeConfigReader.name),
  ) {
    this.kubeConfigPath =
      kubeConfigPath ||
      path.join(process.env.HOME || '/root', '.kube', 'config');
    this.fileSystem = fsInstance || new FileSystem();
    this.yamlParser = yamlParser;
    this.logger = logger;
  }

  public async getKubeConfig(): Promise<ResolvedKubeConfig> {
    try {
      const rawConfig = await this.loadAndParseKubeConfig();
      const config = this.mapKeys(rawConfig);

      const currentContextName = config.currentContext;
      if (!currentContextName) {
        throw new InvalidConfigError('No currentContext is set in kubeconfig.');
      }

      const context = this.getContext(config, currentContextName);
      const cluster = this.getCluster(config, context.cluster);
      const user = this.getUser(config, context.user);

      this.processUserPemData(user);
      this.processClusterPemData(cluster);

      return { cluster, user };
    } catch (error: any) {
      if (error instanceof ConfigFileNotFoundError) {
        throw new KubeConfigError(
          `Failed to load kubeconfig from file: ${error.message}`,
        );
      }
      this.handleError(error);
    }
  }

  public async getInClusterConfig(): Promise<ResolvedKubeConfig> {
    const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
    const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
    const namespacePath =
      '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

    try {
      const serviceHost = process.env.KUBERNETES_SERVICE_HOST;
      const servicePort = process.env.KUBERNETES_SERVICE_PORT;

      if (!serviceHost || !servicePort) {
        this.logger.error(
          'Not running inside a Kubernetes cluster. Environment variables KUBERNETES_SERVICE_HOST or KUBERNETES_SERVICE_PORT are missing.',
        );
        throw new NotInClusterError('Not running inside a Kubernetes cluster.');
      }

      const [tokenExists, caExists, namespaceExists] = await Promise.all([
        this.fileExists(tokenPath),
        this.fileExists(caPath),
        this.fileExists(namespacePath),
      ]);

      if (!tokenExists) {
        this.logger.error(`Missing service account token file at ${tokenPath}`);
        throw new ConfigFileNotFoundError(
          `Service account token is missing at path: ${tokenPath}`,
        );
      }
      if (!caExists) {
        this.logger.error(`Missing CA certificate file at ${caPath}`);
        throw new ConfigFileNotFoundError(
          `CA certificate is missing at path: ${caPath}`,
        );
      }
      if (!namespaceExists) {
        this.logger.warn(`Missing namespace file at ${namespacePath}`);
      }

      const [token, ca] = await Promise.all([
        this.readFileSafely(tokenPath, 'utf8') as Promise<string>,
        this.readFileSafely(caPath) as Promise<Buffer>,
      ]);

      // Validate token
      if (!token.trim()) {
        throw new InvalidConfigError(
          'Service account token is missing or invalid.',
        );
      }

      // Validate CA
      if (!(ca instanceof Buffer) || ca.length === 0) {
        throw new InvalidConfigError('CA certificate is missing or invalid.');
      }

      // Optionally, read and validate namespace
      try {
        const namespace = await this.readFileSafely(namespacePath, 'utf8');
        if (!namespace || typeof namespace !== 'string') {
          this.logger.warn('Namespace is missing or invalid.');
        }
      } catch {
        this.logger.warn('Failed to read namespace file.');
      }

      const server = `https://${serviceHost}:${servicePort}`;

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
      this.handleError(error);
      throw error;
    }
  }

  private async loadAndParseKubeConfig(): Promise<any> {
    const fileContent = await this.fileSystem.readFile(
      this.kubeConfigPath,
      'utf8',
    );
    return this.yamlParser.parse(fileContent);
  }

  private getContext(config: any, contextName: string): any {
    return this.extractConfigSection(
      config,
      'contexts',
      contextName,
      `Context '${contextName}' not found in kubeconfig.`,
    );
  }

  private getCluster(config: any, clusterName: string): any {
    return this.extractConfigSection(
      config,
      'clusters',
      clusterName,
      `Cluster '${clusterName}' not found in kubeconfig.`,
    );
  }

  private getUser(config: any, userName: string): any {
    return this.extractConfigSection(
      config,
      'users',
      userName,
      `User '${userName}' not found in kubeconfig.`,
    );
  }

  private processUserPemData(user: any): void {
    user.clientCertificateData = this.processPemData(
      user.clientCertificateData,
      'CERTIFICATE',
      'clientCertificateData',
    );

    user.clientKeyData = this.processPemData(
      user.clientKeyData,
      'PRIVATE KEY',
      'clientKeyData',
    );
  }

  private processClusterPemData(cluster: any): void {
    cluster.certificateAuthorityData = this.processPemData(
      cluster.certificateAuthorityData,
      'CERTIFICATE',
      'certificateAuthorityData',
    );
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

  private validateAndConvertPem(data: string, type: string): Buffer {
    if (!PemUtils.isValidPem(data, type)) {
      throw new InvalidConfigError(`Invalid PEM format for ${type}.`);
    }
    return PemUtils.pemToBuffer(data, type);
  }

  private processPemData(
    data: string | undefined,
    type: string,
    fieldName: string,
  ): string | undefined {
    if (data) {
      const buffer = this.validateAndConvertPem(data, type);
      return buffer.toString('base64'); // Apply consistent base64 encoding
    }
    return undefined;
  }

  private extractConfigSection(
    config: any,
    section: string,
    name: string,
    errorMessage: string,
  ): any {
    const entry = config[section].find((item: any) => item.name === name);
    if (!entry) {
      this.logger.error(errorMessage); // Log the specific error message here
      throw new ConfigFileNotFoundError(errorMessage);
    }
    return entry[section.slice(0, -1)];
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await this.fileSystem.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async readFileSafely(
    filePath: string,
    encoding?: BufferEncoding,
  ): Promise<string | Buffer> {
    try {
      return await this.fileSystem.readFile(filePath, encoding);
    } catch (error: any) {
      throw new ConfigFileNotFoundError(
        `Failed to read file at ${filePath}: ${error.message}`,
      );
    }
  }

  private async isInCluster(): Promise<boolean> {
    const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
    const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
    const namespacePath =
      '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

    const [tokenExists, caExists, namespaceExists] = await Promise.all([
      this.fileExists(tokenPath),
      this.fileExists(caPath),
      this.fileExists(namespacePath),
    ]);

    if (!tokenExists)
      this.logger.error(`Missing service account token file at ${tokenPath}`);
    if (!caExists)
      this.logger.error(`Missing CA certificate file at ${caPath}`);
    if (!namespaceExists)
      this.logger.warn(`Missing namespace file at ${namespacePath}`); // Namespace is optional

    const serviceHost = process.env.KUBERNETES_SERVICE_HOST;
    const servicePort = process.env.KUBERNETES_SERVICE_PORT;

    return tokenExists && caExists && !!serviceHost && !!servicePort;
  }

  private handleError(error: any): never | null {
    if (error instanceof KubeConfigError) {
      this.logAndThrowError(error);
    } else if (error instanceof SyntaxError) {
      this.logAndThrowError(
        new ParsingError('Failed to parse kubeconfig YAML.', error.message),
      );
    } else if (error.code === 'ENOENT') {
      this.logAndThrowError(new ConfigFileNotFoundError(this.kubeConfigPath));
    } else {
      this.logger.error(`Unexpected error: ${error.message}`, error);
      throw new KubeConfigError(`Failed to read kubeconfig: ${error.message}`);
    }
    return null; // Unreachable
  }

  private logAndThrowError(error: KubeConfigError): never {
    this.logger.error(error.message, error);
    throw error;
  }
}
