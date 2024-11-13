// src/utils/KubeConfigReader.ts

import { join } from 'path';
import { spawn } from 'child_process';
import { ResolvedKubeConfig } from '../models';
import {
  ILogger,
  IFileSystem,
  IYamlParser,
  IKubeConfigReader,
} from '../interfaces';
import { FileSystem } from './FileSystem';
import { Logger } from './Logger';
import { YamlParser } from './YamlParser';
import { PemUtils } from './PemUtils';
import {
  ConfigFileNotFoundError,
  ExecAuthError,
  InvalidConfigError,
  KubeConfigError,
  NotInClusterError,
  ParsingError,
  PemConversionError,
  PemFormatError,
} from '../errors';
import { PemType } from '../enums';

export class KubeConfigReader implements IKubeConfigReader {
  private readonly kubeConfigPath: string;
  private readonly fileSystem: IFileSystem = new FileSystem();
  private readonly yamlParser: IYamlParser = new YamlParser();
  protected readonly logger: ILogger = new Logger(KubeConfigReader.name);

  constructor(kubeConfigPath?: string) {
    this.kubeConfigPath =
      kubeConfigPath || join(process.env.HOME || '/root', '.kube', 'config');
  }

  public async getKubeConfig(): Promise<ResolvedKubeConfig> {
    try {
      const rawConfig = await this.loadAndParseKubeConfig();
      const config = this.mapKeys(rawConfig);

      this.validateConfig(config);

      const { cluster, user } = this.extractConfigDetails(config);

      this.validateData(
        cluster.certificateAuthorityData,
        'certificateAuthorityData',
      );

      // Always convert certificateAuthorityData to PEM if it exists
      const certificateAuthorityPem = cluster.certificateAuthorityData
        ? this.convertBase64ToPem(
            cluster.certificateAuthorityData,
            PemType.CERTIFICATE,
          )
        : undefined;

      let token: string | undefined;
      let clientCertificatePem: string | undefined;
      let clientKeyPem: string | undefined;

      if (user.exec) {
        // Handle exec-based authentication
        token = await this.getExecToken(user.exec);
      } else if (user.token) {
        // Handle token-based authentication
        token = user.token.trim();
      } else {
        // Handle client-certificate-based authentication
        this.validateData(user.clientCertificateData, 'clientCertificateData');
        this.validateData(user.clientKeyData, 'clientKeyData');

        clientCertificatePem = user.clientCertificateData
          ? this.convertBase64ToPem(
              user.clientCertificateData,
              PemType.CERTIFICATE,
            )
          : undefined;

        clientKeyPem = user.clientKeyData
          ? this.convertBase64ToPem(user.clientKeyData, PemType.PRIVATE_KEY)
          : undefined;
      }

      const resolvedConfig: ResolvedKubeConfig = {
        cluster: {
          server: cluster.server,
          certificateAuthorityData: cluster.certificateAuthorityData,
          certificateAuthorityPem,
        },
        user: {
          token,
          clientCertificateData: user.clientCertificateData,
          clientKeyData: user.clientKeyData,
          clientCertificatePem,
          clientKeyPem,
        },
      };

      return resolvedConfig;
    } catch (error: any) {
      await this.handleError(error);
    }
  }

  /**
   * Converts base64-encoded data to a PEM-formatted string.
   * It first tries to decode the data as PEM. If that fails, it assumes the data is DER and converts it to PEM.
   * @param base64Data - The base64-encoded string.
   * @param type - The type of PEM (e.g., CERTIFICATE, PRIVATE KEY).
   * @returns The PEM-formatted string.
   * @throws {PemFormatError | PemConversionError} If conversion fails.
   */
  private convertBase64ToPem(base64Data: string, type: PemType): string {
    try {
      const decoded = Buffer.from(base64Data, 'base64').toString('utf-8');

      if (PemUtils.isValidPem(decoded, type)) {
        // The data is already in PEM format
        return decoded;
      } else {
        // Assume the data is DER-encoded, convert it to PEM
        const pem = PemUtils.bufferToPem(
          Buffer.from(base64Data, 'base64'),
          type,
        );
        // Validate the newly created PEM
        if (!PemUtils.isValidPem(pem, type)) {
          throw new PemFormatError(
            `Converted PEM is invalid for type: ${type}`,
          );
        }
        return pem;
      }
    } catch (error) {
      if (
        error instanceof PemFormatError ||
        error instanceof PemConversionError
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to convert base64 data to PEM for type ${type}`,
        error,
      );
      throw new PemConversionError(
        `Failed to convert base64 data to PEM for type: ${type}`,
      );
    }
  }

  public async getInClusterConfig(): Promise<ResolvedKubeConfig> {
    const inClusterPaths = {
      token: '/var/run/secrets/kubernetes.io/serviceaccount/token',
      ca: '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt',
      namespace: '/var/run/secrets/kubernetes.io/serviceaccount/namespace',
    };

    try {
      this.ensureInClusterEnv();

      await this.validateInClusterFiles(inClusterPaths);

      const [token, caBuffer] = await this.readInClusterFiles(inClusterPaths);

      this.validateInClusterData(token, caBuffer);

      // Convert CA certificate to PEM
      const caPem = PemUtils.bufferToPem(caBuffer, PemType.CERTIFICATE);

      // Optionally, validate the PEM
      if (!PemUtils.isValidPem(caPem, PemType.CERTIFICATE)) {
        throw new PemFormatError('In-cluster CA certificate is invalid.');
      }

      const server = this.constructServerUrl();

      return {
        cluster: {
          server,
          certificateAuthorityData: caBuffer.toString('base64'),
          certificateAuthorityPem: caPem,
        },
        user: {
          token: token.trim(),
        },
      };
    } catch (error: any) {
      await this.handleError(error);
    }
  }

  private async loadAndParseKubeConfig(): Promise<any> {
    const fileContent = await this.fileSystem.readFile(
      this.kubeConfigPath,
      'utf8',
    );
    return this.yamlParser.parse(fileContent);
  }

  private validateConfig(config: any): void {
    if (!config || typeof config !== 'object') {
      throw new InvalidConfigError('Parsed kubeconfig is invalid.');
    }

    if (!config.currentContext) {
      throw new InvalidConfigError('No currentContext is set in kubeconfig.');
    }
  }

  private extractConfigDetails(config: any): { cluster: any; user: any } {
    const currentContextName: string = config.currentContext;
    const context = this.getConfigSection(
      config,
      'contexts',
      currentContextName,
    );
    const cluster = this.getConfigSection(config, 'clusters', context.cluster);
    const user = this.getConfigSection(config, 'users', context.user);
    return { cluster, user };
  }

  private getConfigSection(config: any, section: string, name: string): any {
    const entry = config[section].find((item: any) => item.name === name);
    if (!entry) {
      const errorMessage = `${section.slice(0, -1)} '${name}' not found in kubeconfig.`;
      this.logger.error(`KubeConfig Object: ${JSON.stringify(config)}`);
      throw new ConfigFileNotFoundError(errorMessage);
    }
    return entry[section.slice(0, -1)];
  }

  /**
   * Validates the presence and format of base64-encoded data.
   * @param data - The base64-encoded string.
   * @param fieldName - The name of the field being validated.
   * @throws {InvalidConfigError} If the data is invalid.
   */
  private validateData(data: string | undefined, fieldName: string): void {
    if (data && !PemUtils.isValidBase64(data)) {
      throw new InvalidConfigError(`Invalid base64 format for ${fieldName}.`);
    }
  }

  private mapKeys(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.mapKeys(item));
    } else if (obj !== null && typeof obj === 'object') {
      const mapped: any = {};
      for (const key of Object.keys(obj)) {
        const newKey = key.replace(/-([a-z])/g, (_, char) =>
          char.toUpperCase(),
        );
        mapped[newKey] = this.mapKeys(obj[key]);
      }
      return mapped;
    } else {
      return obj;
    }
  }

  private async validateInClusterFiles(paths: {
    token: string;
    ca: string;
    namespace: string;
  }): Promise<void> {
    const { token, ca } = paths;
    const [tokenExists, caExists] = await Promise.all([
      this.fileExists(token),
      this.fileExists(ca),
    ]);

    const missingFiles: string[] = [];

    if (!tokenExists) {
      this.logger.error(`Missing service account token file at ${token}`);
      missingFiles.push(`Service account token is missing at path: ${token}`);
    }

    if (!caExists) {
      this.logger.error(`Missing CA certificate file at ${ca}`);
      missingFiles.push(`CA certificate is missing at path: ${ca}`);
    }

    if (missingFiles.length > 0) {
      throw new ConfigFileNotFoundError(missingFiles.join('; '));
    }

    // Namespace is optional
    const namespaceExists = await this.fileExists(paths.namespace);
    if (!namespaceExists) {
      this.logger.warn(`Namespace is missing or invalid: ${paths.namespace}`);
    }
  }

  private async readInClusterFiles(paths: {
    token: string;
    ca: string;
  }): Promise<[string, Buffer]> {
    try {
      const [token, ca] = await Promise.all([
        this.fileSystem.readFile(paths.token, 'utf8'),
        this.fileSystem.readFile(paths.ca),
      ]);
      return [token, ca];
    } catch (error: any) {
      throw new ConfigFileNotFoundError(
        `Failed to read in-cluster files: ${error.message}`,
      );
    }
  }

  private validateInClusterData(token: string, ca: Buffer): void {
    if (!token.trim()) {
      throw new InvalidConfigError(
        'Service account token is missing or invalid.',
      );
    }

    if (!(ca instanceof Buffer) || ca.length === 0) {
      throw new InvalidConfigError('CA certificate is missing or invalid.');
    }
  }

  private constructServerUrl(): string {
    const serviceHost = process.env.KUBERNETES_SERVICE_HOST;
    const servicePort = process.env.KUBERNETES_SERVICE_PORT;

    if (!serviceHost || !servicePort) {
      this.logger.error('Missing Kubernetes service environment variables.', {
        serviceHost,
        servicePort,
      });
      throw new ConfigFileNotFoundError(
        'Missing Kubernetes service environment variables.',
      );
    }

    return `https://${serviceHost}:${servicePort}`;
  }

  private ensureInClusterEnv(): void {
    const serviceHost = process.env.KUBERNETES_SERVICE_HOST;
    const servicePort = process.env.KUBERNETES_SERVICE_PORT;

    if (!serviceHost || !servicePort) {
      this.logger.error(
        'Not running inside a Kubernetes cluster. Environment variables KUBERNETES_SERVICE_HOST or KUBERNETES_SERVICE_PORT are missing.',
      );
      throw new NotInClusterError('Not running inside a Kubernetes cluster.');
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await this.fileSystem.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async getExecToken(execConfig: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const { command, args = [], env = {} } = execConfig;
      const child = spawn(command, args, { env: { ...process.env, ...env } });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(
            new ExecAuthError(
              `Exec command failed with code ${code}: ${stderr}`,
            ),
          );
        } else {
          try {
            const execOutput = JSON.parse(stdout);
            if (execOutput.token) {
              resolve(execOutput.token);
            } else {
              reject(new ExecAuthError('Exec command did not return a token.'));
            }
          } catch (parseError) {
            reject(
              new ExecAuthError(
                `Failed to parse exec command output: ${parseError.message}`,
              ),
            );
          }
        }
      });

      child.on('error', (err) => {
        reject(new ExecAuthError(`Failed to execute command: ${err.message}`));
      });
    });
  }

  private async handleError(error: any): Promise<never> {
    if (error instanceof KubeConfigError) {
      this.logError(error);
      throw error;
    }

    if (error instanceof SyntaxError) {
      const parsingError = new ParsingError(
        'Failed to parse kubeconfig YAML.',
        error.message,
      );
      this.logError(parsingError);
      throw parsingError;
    }

    if (error.code === 'ENOENT') {
      const notFoundError = new ConfigFileNotFoundError(this.kubeConfigPath);
      this.logError(notFoundError);
      throw notFoundError;
    }

    this.logger.error(`Unexpected error: ${error.message}`, error);
    throw new KubeConfigError(`Failed to read kubeconfig: ${error.message}`);
  }

  private logError(error: KubeConfigError): void {
    this.logger.error(error.message, error);
  }
}
