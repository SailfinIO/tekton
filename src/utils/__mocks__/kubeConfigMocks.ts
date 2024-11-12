// src/utils/__mocks__/kubeConfigMocks.ts

import { ResolvedKubeConfig } from '../../models';

/**
 * Valid Kubernetes configuration for successful tests.
 */
export const validKubeConfigYaml = `
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${Buffer.from('valid-ca-cert').toString('base64')}
    server: https://127.0.0.1:6443
  name: test-cluster-1
contexts:
- context:
    cluster: test-cluster-1
    user: test-cluster-1
  name: test-cluster-1
current-context: test-cluster-1
kind: Config
preferences: {}
users:
- name: test-cluster-1
  user:
    client-certificate-data: ${Buffer.from('valid-client-cert').toString('base64')}
    client-key-data: ${Buffer.from('valid-client-key').toString('base64')}
`;

/**
 * Parsed valid Kubernetes configuration.
 */
export const parsedValidKubeConfig = {
  apiVersion: 'v1',
  kind: 'Config',
  currentContext: 'test-cluster-1',
  contexts: [
    {
      name: 'test-cluster-1',
      context: {
        cluster: 'test-cluster-1',
        user: 'test-cluster-1',
      },
    },
  ],
  clusters: [
    {
      name: 'test-cluster-1',
      cluster: {
        server: 'https://127.0.0.1:6443',
        certificateAuthorityData:
          Buffer.from('valid-ca-cert').toString('base64'),
      },
    },
  ],
  users: [
    {
      name: 'test-cluster-1',
      user: {
        clientCertificateData:
          Buffer.from('valid-client-cert').toString('base64'),
        clientKeyData: Buffer.from('valid-client-key').toString('base64'),
      },
    },
  ],
};

/**
 * ResolvedKubeConfig examples for expected outputs.
 */
export const resolvedValidKubeConfig: ResolvedKubeConfig = {
  cluster: {
    server: 'https://127.0.0.1:6443',
    certificateAuthorityData: Buffer.from('valid-ca-cert').toString('base64'),
    certificateAuthorityPem: `-----BEGIN CERTIFICATE-----\n${Buffer.from('valid-ca-cert').toString('base64')}\n-----END CERTIFICATE-----`,
  },
  user: {
    clientCertificateData: Buffer.from('valid-client-cert').toString('base64'),
    clientKeyData: Buffer.from('valid-client-key').toString('base64'),
    clientCertificatePem: `-----BEGIN CERTIFICATE-----\n${Buffer.from('valid-client-cert').toString('base64')}\n-----END CERTIFICATE-----`,
    clientKeyPem: `-----BEGIN PRIVATE KEY-----\n${Buffer.from('valid-client-key').toString('base64')}\n-----END PRIVATE KEY-----`,
    token: undefined, // Explicitly include token as undefined
  },
};

/**
 * ResolvedKubeConfig with only token and CA data (for in-cluster config).
 */
export const resolvedInClusterKubeConfig: ResolvedKubeConfig = {
  cluster: {
    server: 'https://10.0.0.1:443',
    certificateAuthorityData: Buffer.from('ca-cert').toString('base64'),
    certificateAuthorityPem: `-----BEGIN CERTIFICATE-----\n${Buffer.from('ca-cert').toString('base64')}\n-----END CERTIFICATE-----`,
  },
  user: {
    token: 'mycluster-token', // Plain text
  },
};

/**
 * KubeConfig with empty currentContext.
 */
export const kubeConfigWithEmptyCurrentContext = {
  ...parsedValidKubeConfig,
  currentContext: '',
};

/**
 * KubeConfig with invalid certificateAuthorityData (invalid base64 format).
 */
export const kubeConfigWithInvalidCA = {
  ...parsedValidKubeConfig,
  clusters: [
    {
      ...parsedValidKubeConfig.clusters[0],
      cluster: {
        ...parsedValidKubeConfig.clusters[0].cluster,
        certificateAuthorityData: 'invalid-base64-ca',
      },
    },
  ],
};

/**
 * KubeConfig with invalid clientCertificateData (invalid base64 format).
 */
export const kubeConfigWithInvalidUserCert = {
  ...parsedValidKubeConfig,
  users: [
    {
      ...parsedValidKubeConfig.users[0],
      user: {
        ...parsedValidKubeConfig.users[0].user,
        clientCertificateData: 'invalid-base64-cert',
      },
    },
  ],
};

/**
 * KubeConfig with invalid clientKeyData (invalid base64 format).
 */
export const kubeConfigWithInvalidUserKey = {
  ...parsedValidKubeConfig,
  users: [
    {
      ...parsedValidKubeConfig.users[0],
      user: {
        ...parsedValidKubeConfig.users[0].user,
        clientKeyData: 'invalid-base64-key',
      },
    },
  ],
};

/**
 * KubeConfig with non-existent user.
 */
export const kubeConfigWithNonExistentUser = {
  ...parsedValidKubeConfig,
  contexts: [
    {
      name: 'test-context',
      context: {
        cluster: 'test-cluster-1',
        user: 'non-existent-user',
      },
    },
  ],
};

/**
 * KubeConfig with malformed YAML (as a string).
 */
export const malformedKubeConfigYaml = `
apiVersion: v1
clusters
  - name: test-cluster
    cluster:
      server: https://localhost:6443
      certificate-authority-data: |
        -----BEGIN CERTIFICATE-----
        MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
        ...
        -----END CERTIFICATE-----
contexts:
  - name: test-context
    context:
      cluster: test-cluster
      user: test-user
current-context: test-context
users:
  - name: test-user
    user:
      token: mytoken
`; // Note the missing colon after 'clusters'

export const tokenKubeConfigYaml = `
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${Buffer.from('valid-ca-cert').toString('base64')}
    server: https://127.0.0.1:6443
  name: test-cluster-1
contexts:
- context:
    cluster: test-cluster-1
    user: test-token-user
  name: test-cluster-1
current-context: test-cluster-1
kind: Config
preferences: {}
users:
- name: test-token-user
  user:
    token: my-token
`;

export const parsedTokenKubeConfig = {
  apiVersion: 'v1',
  kind: 'Config',
  currentContext: 'test-cluster-1',
  contexts: [
    {
      name: 'test-cluster-1',
      context: {
        cluster: 'test-cluster-1',
        user: 'test-token-user',
      },
    },
  ],
  clusters: [
    {
      name: 'test-cluster-1',
      cluster: {
        server: 'https://127.0.0.1:6443',
        certificateAuthorityData:
          Buffer.from('valid-ca-cert').toString('base64'),
      },
    },
  ],
  users: [
    {
      name: 'test-token-user',
      user: {
        token: 'my-token',
      },
    },
  ],
};

export const resolvedTokenKubeConfig: ResolvedKubeConfig = {
  cluster: {
    server: 'https://127.0.0.1:6443',
    certificateAuthorityData: Buffer.from('valid-ca-cert').toString('base64'),
    certificateAuthorityPem: `-----BEGIN CERTIFICATE-----\n${Buffer.from('valid-ca-cert').toString('base64')}\n-----END CERTIFICATE-----`,
  },
  user: {
    token: 'my-token',
  },
};
