// src/utils/KubeConfigReader.ts

import { readFileSync } from 'fs';
import { KubeConfig, ResolvedKubeConfig } from '../models';
import { YamlParser } from './YamlParser';
import { Logger } from './Logger';

export class KubeConfigReader {
  private kubeConfigPath: string;
  private readonly logger = new Logger(KubeConfigReader.name);

  constructor(kubeConfigPath?: string) {
    this.kubeConfigPath = kubeConfigPath || `${process.env.HOME}/.kube/config`;
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
      const fileContent = readFileSync(this.kubeConfigPath, 'utf8');
      const rawConfig = YamlParser.parse(fileContent);
      const config: KubeConfig = this.mapKeys(rawConfig);

      const currentContextName = config['current-context'];
      const context = config.contexts.find(
        (ctx) => ctx.name === currentContextName,
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
        (c) => c.name === context.cluster,
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

      const userEntry = config.users.find((u) => u.name === context.user);
      const user = userEntry?.user;

      if (!user) {
        this.logger.error(`User '${context.user}' not found in kubeconfig.`);
        throw new Error(`User '${context.user}' not found in kubeconfig.`);
      }

      return {
        cluster,
        user,
      };
    } catch (error) {
      this.logger.error(`Failed to read kubeconfig: ${error.message}`);
      return null;
    }
  }
}
