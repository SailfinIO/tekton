// src/interfaces/KubeConfig.ts

import { EnvVar } from './EnvVar';

export interface Cluster {
  name: string;
  cluster: {
    server: string;
    certificateAuthority?: string;
    certificateAuthorityData?: string;
    [key: string]: any;
  };
}

export interface User {
  name: string;
  user: {
    token?: string;
    username?: string;
    password?: string;
    clientCertificate?: string;
    clientCertificateData?: string;
    clientKey?: string;
    clientKeyData?: string;
    authProvider?: {
      name: string;
      config: { [key: string]: any };
    };
    exec?: {
      apiVersion?: string;
      command: string;
      args?: string[];
      env?: EnvVar[];
    };
    [key: string]: any;
  };
}

export interface Context {
  name: string;
  context: {
    cluster: string;
    user: string;
    namespace?: string;
    [key: string]: any;
  };
}

export interface KubeConfig {
  apiVersion?: string;
  kind?: string;
  preferences?: any;
  'current-context'?: string;
  clusters?: Cluster[];
  users?: User[];
  contexts?: Context[];
  cluster: Cluster['cluster'];
  user: User['user'];
}
