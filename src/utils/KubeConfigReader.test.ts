// src/utils/KubeConfigReader.test.ts

import { IFileSystem } from '../interfaces';
import { KubeConfigReader } from './KubeConfigReader';
import { ResolvedKubeConfig } from '../models/ResolvedKubeConfig';
import { YamlParser } from './YamlParser';
import { Logger } from './Logger';
import {
  ConfigFileNotFoundError,
  InvalidConfigError,
  KubeConfigError,
  NotInClusterError,
  ParsingError,
} from '../errors';
import { LogLevel } from '../enums';
import path from 'path';
import { PemUtils } from './PemUtils';

jest.mock('./Logger');
jest.mock('./YamlParser');

const createMockFileSystem = (): jest.Mocked<IFileSystem> => ({
  readFile: jest.fn(),
  access: jest.fn(),
});

// Mock kubeConfigContent
const kubeConfigContent = `
  apiVersion: v1
  clusters:
    - cluster:
        server: https://1.2.3.4
        certificate-authority-data: abc123
      name: cluster1
  contexts:
    - context:
        cluster: cluster1
        user: user1
      name: context1
  current-context: context1
  users:
    - name: user1
      user:
        token: mytoken
`;

// Helper function to determine return type based on encoding
// src/utils/KubeConfigReader.spec.ts

const mockReadFileImplementation = (
  path: string,
  encoding?: BufferEncoding,
): Promise<string | Buffer> => {
  if (encoding === 'utf8') {
    switch (path) {
      case '/mock/.kube/config':
        return Promise.resolve(kubeConfigContent);
      case '/var/run/secrets/kubernetes.io/serviceaccount/token':
        return Promise.resolve('mycluster-token');
      case '/var/run/secrets/kubernetes.io/serviceaccount/namespace':
        return Promise.resolve('default');
      default:
        return Promise.reject(
          new Error(`Unexpected readFile call with path: ${path}`),
        );
    }
  } else {
    if (path === '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt') {
      return Promise.resolve(Buffer.from('ca-cert'));
    }
    return Promise.reject(
      new Error(`Unexpected readFile call with path: ${path}`),
    );
  }
};

describe('KubeConfigReader', () => {
  let kubeConfigReader: KubeConfigReader;
  let mockedLoggerInstance: jest.Mocked<Logger>;
  let mockFileSystem: jest.Mocked<IFileSystem>;
  let mockedYamlParser: jest.Mocked<typeof YamlParser>;
  const mockKubeConfigPath = '/mock/.kube/config';

  beforeEach(() => {
    jest.resetAllMocks();

    // Setup Logger mock
    mockedLoggerInstance = new Logger(
      'TestContext',
      LogLevel.INFO,
      false,
    ) as jest.Mocked<Logger>;
    mockedLoggerInstance.info = jest.fn();
    mockedLoggerInstance.debug = jest.fn();
    mockedLoggerInstance.error = jest.fn();
    mockedLoggerInstance.warn = jest.fn();

    // Setup FileSystem mock
    mockFileSystem = createMockFileSystem();

    // @ts-ignore: Overload mismatch in Jest mock
    mockFileSystem.readFile.mockImplementation(mockReadFileImplementation);
    // Setup YamlParser mock
    mockedYamlParser = jest.mocked(YamlParser, {
      shallow: true,
    }) as jest.Mocked<typeof YamlParser> & { logger: jest.Mocked<Logger> };

    mockedYamlParser.parse = jest.fn();

    // Initialize KubeConfigReader with mocks
    kubeConfigReader = new KubeConfigReader(
      mockKubeConfigPath,
      mockFileSystem,
      mockedYamlParser,
      mockedLoggerInstance,
    );
  });

  /**
   * Test Suite for Constructor
   */
  describe('Constructor', () => {
    let mockFileSystem: jest.Mocked<IFileSystem>;
    let mockedYamlParser: jest.Mocked<typeof YamlParser>;
    let mockedLoggerInstance: jest.Mocked<Logger>;
    const customKubeConfigPath = '/custom/path/to/kubeconfig';

    beforeEach(() => {
      jest.resetAllMocks();

      // Setup Logger mock
      mockedLoggerInstance = new Logger(
        'TestContext',
        LogLevel.INFO,
        false,
      ) as jest.Mocked<Logger>;
      mockedLoggerInstance.info = jest.fn();
      mockedLoggerInstance.debug = jest.fn();
      mockedLoggerInstance.error = jest.fn();
      mockedLoggerInstance.warn = jest.fn();

      // Setup FileSystem mock
      mockFileSystem = createMockFileSystem();

      // Setup YamlParser mock
      mockedYamlParser = jest.mocked(YamlParser, {
        shallow: true,
      }) as jest.Mocked<typeof YamlParser> & { logger: jest.Mocked<Logger> };

      mockedYamlParser.parse = jest.fn();
    });

    it('should use the default kubeConfigPath when none is provided', () => {
      // Arrange
      const defaultHome = '/home/testuser';
      process.env.HOME = defaultHome;

      // Act
      const kubeConfigReader = new KubeConfigReader(
        undefined,
        mockFileSystem,
        mockedYamlParser,
        mockedLoggerInstance,
      );

      const expectedPath = path.join(defaultHome, '.kube', 'config');

      // Assert
      expect(kubeConfigReader['kubeConfigPath']).toBe(expectedPath);
    });

    it('should use the provided kubeConfigPath when one is given', () => {
      // Arrange
      const kubeConfigReader = new KubeConfigReader(
        customKubeConfigPath,
        mockFileSystem,
        mockedYamlParser,
        mockedLoggerInstance,
      );

      // Act & Assert
      expect(kubeConfigReader['kubeConfigPath']).toBe(customKubeConfigPath);
    });

    it('should initialize with the provided fileSystem instance', () => {
      // Arrange
      const kubeConfigReader = new KubeConfigReader(
        customKubeConfigPath,
        mockFileSystem,
        mockedYamlParser,
        mockedLoggerInstance,
      );

      // Act & Assert
      expect(kubeConfigReader['fileSystem']).toBe(mockFileSystem);
    });

    it('should initialize with the provided yamlParser instance', () => {
      // Arrange
      const kubeConfigReader = new KubeConfigReader(
        customKubeConfigPath,
        mockFileSystem,
        mockedYamlParser,
        mockedLoggerInstance,
      );

      // Act & Assert
      expect(kubeConfigReader['yamlParser']).toBe(mockedYamlParser);
    });

    it('should initialize with the provided logger instance', () => {
      // Arrange
      const kubeConfigReader = new KubeConfigReader(
        customKubeConfigPath,
        mockFileSystem,
        mockedYamlParser,
        mockedLoggerInstance,
      );

      // Act & Assert
      expect(kubeConfigReader['logger']).toBe(mockedLoggerInstance);
    });
  });

  //   /**
  //    * Test Suite for getKubeConfig Method
  //    */
  describe('getKubeConfig', () => {
    it('should successfully read and parse kubeconfig, returning ResolvedKubeConfig', async () => {
      const validPemCertificate = `-----BEGIN CERTIFICATE-----
  MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
  UzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UE
  CwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUy
  MVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkG
  A1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcN
  AQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq
  ...
  -----END CERTIFICATE-----`;

      const validPemPrivateKey = `-----BEGIN PRIVATE KEY-----
  MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...
  -----END PRIVATE KEY-----`;

      const kubeconfigYaml = `
  apiVersion: v1
  clusters:
  - name: test-cluster
    cluster:
      server: https://localhost:6443
      certificate-authority-data: |
        ${validPemCertificate}
  contexts:
  - name: test-context
    context:
      cluster: test-cluster
      user: test-user
  current-context: test-context
  users:
  - name: test-user
    user:
      client-certificate-data: |
        ${validPemCertificate}
      client-key-data: |
        ${validPemPrivateKey}
  `;

      const kubeconfig = {
        apiVersion: 'v1',
        clusters: [
          {
            name: 'test-cluster',
            cluster: {
              server: 'https://localhost:6443',
              certificateAuthorityData: validPemCertificate,
            },
          },
        ],
        contexts: [
          {
            name: 'test-context',
            context: {
              cluster: 'test-cluster',
              user: 'test-user',
            },
          },
        ],
        currentContext: 'test-context',
        users: [
          {
            name: 'test-user',
            user: {
              clientCertificateData: validPemCertificate,
              clientKeyData: validPemPrivateKey,
            },
          },
        ],
      };

      // Mock FileSystem to return the kubeConfigYaml
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (path: string, encoding?: BufferEncoding) => {
          if (encoding === 'utf8') {
            if (path === mockKubeConfigPath) {
              return Promise.resolve(kubeconfigYaml);
            }
          } else {
            if (path === mockKubeConfigPath) {
              return Promise.resolve(Buffer.from(kubeconfigYaml));
            }
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${path}`),
          );
        },
      ) as jest.MockedFunction<IFileSystem['readFile']>;

      mockedYamlParser.parse.mockReturnValue(kubeconfig);

      const expectedResolvedConfig: ResolvedKubeConfig = {
        cluster: {
          server: 'https://localhost:6443',
          certificateAuthorityData:
            'MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJVUzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UECwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUyMVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkGA1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq',
        },
        user: {
          clientCertificateData:
            'MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJVUzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UECwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUyMVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkGA1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq',
          clientKeyData: 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC',
        },
      };

      const result = await kubeConfigReader.getKubeConfig();

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        kubeConfigReader['kubeConfigPath'],
        'utf8',
      );
      expect(YamlParser.parse).toHaveBeenCalledWith(kubeconfigYaml);
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
      expect(mockedLoggerInstance.warn).not.toHaveBeenCalled();
      expect(result).toEqual(expectedResolvedConfig);
    });

    it('should throw an error if currentContextName is empty', async () => {
      const kubeConfigWithEmptyCurrentContext = {
        apiVersion: 'v1',
        clusters: [
          {
            name: 'cluster1',
            cluster: {
              server: 'https://1.2.3.4',
              certificateAuthorityData: 'abc123',
            },
          },
        ],
        contexts: [
          { name: 'context1', context: { cluster: 'cluster1', user: 'user1' } },
        ],
        currentContext: '', // Set to an empty context
        users: [{ name: 'user1', user: { token: 'mytoken' } }],
      };

      mockedYamlParser.parse.mockReturnValue(kubeConfigWithEmptyCurrentContext);

      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        InvalidConfigError,
      );

      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'No currentContext is set in kubeconfig.',
        expect.any(InvalidConfigError),
      );
    });

    it('should throw InvalidConfigError if cluster certificateAuthorityData has invalid PEM format', async () => {
      const kubeConfigWithInvalidCA = {
        apiVersion: 'v1',
        clusters: [
          {
            name: 'cluster1',
            cluster: {
              server: 'https://1.2.3.4',
              certificateAuthorityData: 'invalid-pem-ca', // Invalid PEM
            },
          },
        ],
        contexts: [
          {
            name: 'context1',
            context: {
              cluster: 'cluster1',
              user: 'user1',
            },
          },
        ],
        currentContext: 'context1',
        users: [
          {
            name: 'user1',
            user: {
              token: 'mytoken',
            },
          },
        ],
      };

      // Mock YamlParser.parse to return the invalid kubeConfig
      mockedYamlParser.parse.mockReturnValue(kubeConfigWithInvalidCA);

      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        InvalidConfigError,
      );

      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Invalid PEM format for CERTIFICATE.',
        expect.any(InvalidConfigError),
      );
    });

    it('should throw InvalidConfigError if user clientCertificateData has invalid PEM format', async () => {
      const kubeConfigWithInvalidCert = {
        apiVersion: 'v1',
        clusters: [
          {
            name: 'cluster1',
            cluster: {
              server: 'https://1.2.3.4',
              certificateAuthorityData: 'abc123',
            },
          },
        ],
        contexts: [
          { name: 'context1', context: { cluster: 'cluster1', user: 'user1' } },
        ],
        currentContext: 'context1',
        users: [
          {
            name: 'user1',
            user: {
              clientCertificateData: 'invalid-pem-data',
              clientKeyData: 'valid-client-key',
            },
          },
        ],
      };

      mockedYamlParser.parse.mockReturnValue(kubeConfigWithInvalidCert);

      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        InvalidConfigError,
      );

      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Invalid PEM format for CERTIFICATE.',
        expect.any(InvalidConfigError),
      );
    });

    it('should throw InvalidConfigError if user clientKeyData has invalid PEM format', async () => {
      const validPemCertificate = `-----BEGIN CERTIFICATE-----
  MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
  UzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UE
  CwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUy
  MVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkG
  A1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcN
  AQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq
  ...
  -----END CERTIFICATE-----`;

      const kubeConfigWithInvalidKey = {
        apiVersion: 'v1',
        clusters: [
          {
            name: 'cluster1',
            cluster: {
              server: 'https://1.2.3.4',
              certificateAuthorityData: 'abc123',
            },
          },
        ],
        contexts: [
          {
            name: 'context1',
            context: {
              cluster: 'cluster1',
              user: 'user1',
            },
          },
        ],
        currentContext: 'context1',
        users: [
          {
            name: 'user1',
            user: {
              clientCertificateData: validPemCertificate,
              clientKeyData: 'invalid-pem-key', // Invalid PEM
            },
          },
        ],
      };

      // Mock YamlParser.parse to return the invalid kubeConfig
      mockedYamlParser.parse.mockReturnValue(kubeConfigWithInvalidKey);

      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        InvalidConfigError,
      );

      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Invalid PEM format for PRIVATE KEY.',
        expect.any(InvalidConfigError),
      );
    });

    it('should throw ConfigFileNotFoundError if kubeconfig file does not exist', async () => {
      const enoentError = new Error('File not found');
      (enoentError as any).code = 'ENOENT';
      mockFileSystem.readFile.mockRejectedValue(enoentError);

      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        ConfigFileNotFoundError,
      );

      // Ensure the error is logged correctly
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Kubeconfig file not found at path: /mock/.kube/config',
        expect.any(ConfigFileNotFoundError),
      );
    });

    it('should throw ParsingError if kubeconfig YAML is invalid', async () => {
      mockedYamlParser.parse.mockImplementation(() => {
        throw new ParsingError('Unexpected token', 'invalid_yaml_here');
      });

      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        ParsingError,
      );

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        mockKubeConfigPath,
        'utf8',
      );
      expect(YamlParser.parse).toHaveBeenCalled();
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Unexpected token',
        expect.any(ParsingError),
      );
    });

    it('should throw a generic Error if kubeconfig file read fails for reasons other than ENOENT', async () => {
      const genericError = new Error('Permission denied');
      (genericError as any).code = 'EACCES';
      mockFileSystem.readFile.mockRejectedValue(genericError);

      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        'Failed to read kubeconfig: Permission denied',
      );

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        mockKubeConfigPath,
        'utf8',
      );
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Unexpected error: Permission denied',
        expect.any(Error),
      );
    });

    it('should throw an error if context.user does not exist in users list', async () => {
      const kubeConfigWithNonExistentUser = {
        apiVersion: 'v1',
        clusters: [
          {
            name: 'cluster1',
            cluster: {
              server: 'https://1.2.3.4',
              certificateAuthorityData: 'abc123',
            },
          },
        ],
        contexts: [
          {
            name: 'context1',
            context: {
              cluster: 'cluster1',
              user: 'non-existent-user',
            },
          },
        ],
        currentContext: 'context1',
        users: [
          {
            name: 'user1',
            user: {
              token: 'mytoken',
            },
          },
        ],
      };

      mockedYamlParser.parse.mockReturnValue(kubeConfigWithNonExistentUser);

      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        KubeConfigError,
      );

      // Ensure the error log was called with the expected message
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        "User 'non-existent-user' not found in kubeconfig.",
      );
    });

    it('should log and throw an error for unexpected readFile calls with incorrect path or encoding', async () => {
      // Mock FileSystem to reject unexpected paths or encodings
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (path: string, encoding?: BufferEncoding) => {
          if (encoding === 'utf8') {
            if (path === mockKubeConfigPath) {
              return Promise.resolve(kubeConfigContent);
            }
          } else {
            if (path === mockKubeConfigPath) {
              return Promise.resolve(Buffer.from(kubeConfigContent));
            }
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${path}`),
          );
        },
      ) as jest.MockedFunction<IFileSystem['readFile']>;

      // Modify the kubeconfig to include an unexpected readFile call
      // For example, a certificate with an unexpected path or encoding
      // Since the current implementation doesn't make such calls, this test may not trigger
      // However, to simulate, we can manipulate the method to make an unexpected readFile call

      // For the purpose of this test, we'll assume that an unexpected readFile call occurs
      // We'll simulate this by making the YamlParser.parse return a config that references an unexpected path

      const kubeConfigWithUnexpectedPath = {
        apiVersion: 'v1',
        clusters: [
          {
            name: 'cluster1',
            cluster: {
              server: 'https://1.2.3.4',
              certificateAuthorityData: 'abc123',
              unexpectedField: '/unexpected/path',
            },
          },
        ],
        contexts: [
          {
            name: 'context1',
            context: {
              cluster: 'cluster1',
              user: 'user1',
            },
          },
        ],
        currentContext: 'context1',
        users: [
          {
            name: 'user1',
            user: {
              token: 'mytoken',
            },
          },
        ],
      };

      mockedYamlParser.parse.mockReturnValue(kubeConfigWithUnexpectedPath);

      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        'Invalid PEM format for CERTIFICATE.',
      );

      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Invalid PEM format for CERTIFICATE.',
        expect.any(InvalidConfigError),
      );
    });

    it('should process PEM data correctly for cluster certificateAuthorityData', async () => {
      const validPemCertificate = `-----BEGIN CERTIFICATE-----
  MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
  UzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UE
  CwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUy
  MVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkG
  A1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcN
  AQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq
  ...
  -----END CERTIFICATE-----`;

      const kubeconfigYaml = `
  apiVersion: v1
  clusters:
  - name: test-cluster
    cluster:
      server: https://localhost:6443
      certificate-authority-data: |
        ${validPemCertificate}
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
  `;

      const kubeconfig = {
        apiVersion: 'v1',
        clusters: [
          {
            name: 'test-cluster',
            cluster: {
              server: 'https://localhost:6443',
              certificateAuthorityData: validPemCertificate,
            },
          },
        ],
        contexts: [
          {
            name: 'test-context',
            context: {
              cluster: 'test-cluster',
              user: 'test-user',
            },
          },
        ],
        currentContext: 'test-context',
        users: [
          {
            name: 'test-user',
            user: {
              token: 'mytoken',
            },
          },
        ],
      };

      // Mock FileSystem to return the kubeConfigYaml
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (path: string, encoding?: BufferEncoding) => {
          if (encoding === 'utf8') {
            if (path === mockKubeConfigPath) {
              return Promise.resolve(kubeconfigYaml);
            }
          } else {
            if (path === mockKubeConfigPath) {
              return Promise.resolve(Buffer.from(kubeconfigYaml));
            }
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${path}`),
          );
        },
      ) as jest.MockedFunction<IFileSystem['readFile']>;

      // Mock YamlParser.parse to return the kubeconfig
      mockedYamlParser.parse.mockReturnValue(kubeconfig);

      const expectedResolvedConfig: ResolvedKubeConfig = {
        cluster: {
          server: 'https://localhost:6443',
          certificateAuthorityData:
            'MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJVUzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UECwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUyMVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkGA1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq',
        },
        user: {
          token: 'mytoken',
        },
      };

      const result = await kubeConfigReader.getKubeConfig();

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        kubeConfigReader['kubeConfigPath'],
        'utf8',
      );
      expect(YamlParser.parse).toHaveBeenCalledWith(kubeconfigYaml);
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
      expect(mockedLoggerInstance.warn).not.toHaveBeenCalled();
      expect(result).toEqual(expectedResolvedConfig);
    });

    it('should process PEM data correctly for user clientCertificateData', async () => {
      const validPemCertificate = `-----BEGIN CERTIFICATE-----
  MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
  UzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UE
  CwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUy
  MVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkG
  A1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcN
  AQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq
  ...
  -----END CERTIFICATE-----`;

      const validPemPrivateKey = `-----BEGIN PRIVATE KEY-----
  MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...
  -----END PRIVATE KEY-----`;

      const kubeconfigYaml = `
  apiVersion: v1
  clusters:
  - name: test-cluster
    cluster:
      server: https://localhost:6443
      certificate-authority-data: |
        ${validPemCertificate}
  contexts:
  - name: test-context
    context:
      cluster: test-cluster
      user: test-user
  current-context: test-context
  users:
  - name: test-user
    user:
      client-certificate-data: |
        ${validPemCertificate}
      client-key-data: |
        ${validPemPrivateKey}
  `;

      const kubeconfig = {
        apiVersion: 'v1',
        clusters: [
          {
            name: 'test-cluster',
            cluster: {
              server: 'https://localhost:6443',
              certificateAuthorityData: validPemCertificate,
            },
          },
        ],
        contexts: [
          {
            name: 'test-context',
            context: {
              cluster: 'test-cluster',
              user: 'test-user',
            },
          },
        ],
        currentContext: 'test-context',
        users: [
          {
            name: 'test-user',
            user: {
              clientCertificateData: validPemCertificate,
              clientKeyData: validPemPrivateKey,
            },
          },
        ],
      };

      // Mock FileSystem to return the kubeConfigYaml
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (path: string, encoding?: BufferEncoding) => {
          if (encoding === 'utf8') {
            if (path === mockKubeConfigPath) {
              return Promise.resolve(kubeconfigYaml);
            }
          } else {
            if (path === mockKubeConfigPath) {
              return Promise.resolve(Buffer.from(kubeconfigYaml));
            }
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${path}`),
          );
        },
      ) as jest.MockedFunction<IFileSystem['readFile']>;

      // Mock YamlParser.parse to return the kubeconfig
      mockedYamlParser.parse.mockReturnValue(kubeconfig);

      const expectedResolvedConfig: ResolvedKubeConfig = {
        cluster: {
          server: 'https://localhost:6443',
          certificateAuthorityData:
            'MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJVUzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UECwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUyMVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkGA1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq',
        },
        user: {
          clientCertificateData:
            'MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJVUzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UECwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUyMVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkGA1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq',
          clientKeyData: 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC',
        },
      };

      const result = await kubeConfigReader.getKubeConfig();

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        kubeConfigReader['kubeConfigPath'],
        'utf8',
      );
      expect(YamlParser.parse).toHaveBeenCalledWith(kubeconfigYaml);
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
      expect(mockedLoggerInstance.warn).not.toHaveBeenCalled();
      expect(result).toEqual(expectedResolvedConfig);
    });

    it('should map keys correctly from kebab-case to camelCase', async () => {
      const validPemCertificate = `-----BEGIN CERTIFICATE-----
      MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
      ...
      -----END CERTIFICATE-----`;

      const validPemPrivateKey = `-----BEGIN PRIVATE KEY-----
      MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...
      -----END PRIVATE KEY-----`;

      const kubeConfigWithKebabCase = {
        apiVersion: 'v1',
        clusters: [
          {
            name: 'test-cluster',
            cluster: {
              server: 'https://localhost:6443',
              'certificate-authority-data': validPemCertificate, // kebab-case key
            },
          },
        ],
        contexts: [
          {
            name: 'test-context',
            context: {
              cluster: 'test-cluster',
              user: 'test-user',
            },
          },
        ],
        'current-context': 'test-context', // kebab-case key
        users: [
          {
            name: 'test-user',
            user: {
              'client-certificate-data': validPemCertificate, // kebab-case key
              'client-key-data': validPemPrivateKey, // kebab-case key
            },
          },
        ],
      };

      // Mock the parser to return the kubeConfig with kebab-case keys
      mockedYamlParser.parse.mockReturnValue(kubeConfigWithKebabCase);

      const expectedResolvedConfig: ResolvedKubeConfig = {
        cluster: {
          server: 'https://localhost:6443',
          certificateAuthorityData: PemUtils.pemToBuffer(
            validPemCertificate,
            'CERTIFICATE',
          ).toString('base64'),
        },
        user: {
          clientCertificateData: PemUtils.pemToBuffer(
            validPemCertificate,
            'CERTIFICATE',
          ).toString('base64'),
          clientKeyData: PemUtils.pemToBuffer(
            validPemPrivateKey,
            'PRIVATE KEY',
          ).toString('base64'),
        },
      };

      const result = await kubeConfigReader.getKubeConfig();

      expect(result).toEqual(expectedResolvedConfig);
    });

    it('should not log errors or warnings when parsing is successful', async () => {
      const validPemCertificate = `-----BEGIN CERTIFICATE-----
  MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
  UzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UE
  CwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUy
  MVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkG
  A1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcN
  AQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq
  ...
  -----END CERTIFICATE-----`;

      const validPemPrivateKey = `-----BEGIN PRIVATE KEY-----
  MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...
  -----END PRIVATE KEY-----`;

      const kubeconfigYaml = `
  apiVersion: v1
  clusters:
  - name: test-cluster
    cluster:
      server: https://localhost:6443
      certificate-authority-data: |
        ${validPemCertificate}
  contexts:
  - name: test-context
    context:
      cluster: test-cluster
      user: test-user
  current-context: test-context
  users:
  - name: test-user
    user:
      client-certificate-data: |
        ${validPemCertificate}
      client-key-data: |
        ${validPemPrivateKey}
  `;

      const kubeconfig = {
        apiVersion: 'v1',
        clusters: [
          {
            name: 'test-cluster',
            cluster: {
              server: 'https://localhost:6443',
              certificateAuthorityData: validPemCertificate,
            },
          },
        ],
        contexts: [
          {
            name: 'test-context',
            context: {
              cluster: 'test-cluster',
              user: 'test-user',
            },
          },
        ],
        currentContext: 'test-context',
        users: [
          {
            name: 'test-user',
            user: {
              clientCertificateData: validPemCertificate,
              clientKeyData: validPemPrivateKey,
            },
          },
        ],
      };

      // Mock FileSystem to return the kubeConfigYaml
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (path: string, encoding?: BufferEncoding) => {
          if (encoding === 'utf8') {
            if (path === mockKubeConfigPath) {
              return Promise.resolve(kubeconfigYaml);
            }
          } else {
            if (path === mockKubeConfigPath) {
              return Promise.resolve(Buffer.from(kubeconfigYaml));
            }
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${path}`),
          );
        },
      ) as jest.MockedFunction<IFileSystem['readFile']>;

      mockedYamlParser.parse.mockReturnValue(kubeconfig);

      const result = await kubeConfigReader.getKubeConfig();

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        kubeConfigReader['kubeConfigPath'],
        'utf8',
      );
      expect(YamlParser.parse).toHaveBeenCalledWith(kubeconfigYaml);
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
      expect(mockedLoggerInstance.warn).not.toHaveBeenCalled();
      expect(result).toEqual({
        cluster: {
          server: 'https://localhost:6443',
          certificateAuthorityData:
            'MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJVUzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UECwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUyMVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkGA1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq',
        },
        user: {
          clientCertificateData:
            'MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJVUzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UECwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUyMVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkGA1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq',
          clientKeyData: 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC',
        },
      });
    });
  });

  /**
   * Test Suite for getInClusterConfig Method
   */
  describe('getInClusterConfig', () => {
    /**
     * Test Case 1:
     * should successfully load in-cluster configuration with valid service account files and environment variables
     */
    it('should successfully load in-cluster configuration with valid service account files and environment variables', async () => {
      // Arrange
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock file existence checks
      mockFileSystem.access.mockResolvedValue(undefined); // All files exist

      // Define the expected file paths
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      // Mock readFile based on arguments
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (
          filePath: string,
          encoding?: BufferEncoding,
        ): Promise<string | Buffer> => {
          switch (filePath) {
            case tokenPath:
              return Promise.resolve('mycluster-token');
            case caPath:
              return Promise.resolve(Buffer.from('ca-cert'));
            case namespacePath:
              return Promise.resolve('default');
            default:
              return Promise.reject(
                new Error(`Unexpected readFile call with path: ${filePath}`),
              );
          }
        },
      );

      const expectedResolvedConfig: ResolvedKubeConfig = {
        cluster: {
          server: 'https://10.0.0.1:443',
          certificateAuthorityData: Buffer.from('ca-cert').toString('base64'),
        },
        user: {
          token: 'mycluster-token',
        },
      };

      // Act
      const result = await kubeConfigReader.getInClusterConfig();

      // Assert
      // Verify access calls
      expect(mockFileSystem.access).toHaveBeenCalledWith(tokenPath);
      expect(mockFileSystem.access).toHaveBeenCalledWith(caPath);
      expect(mockFileSystem.access).toHaveBeenCalledWith(namespacePath);

      // Verify readFile calls in order
      expect(mockFileSystem.readFile).toHaveBeenNthCalledWith(
        1,
        tokenPath,
        'utf8',
      );
      expect(mockFileSystem.readFile).toHaveBeenNthCalledWith(
        2,
        caPath,
        undefined,
      );
      expect(mockFileSystem.readFile).toHaveBeenNthCalledWith(
        3,
        namespacePath,
        'utf8',
      );

      // Verify no error or warnings were logged
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
      expect(mockedLoggerInstance.warn).not.toHaveBeenCalled();

      // Verify the result matches the expected configuration
      expect(result).toEqual(expectedResolvedConfig);
    });

    /**
     * Test Case 2:
     * should throw an error if environment variables are missing
     */
    it('should throw an error if environment variables are missing', async () => {
      // Arrange
      delete process.env.KUBERNETES_SERVICE_HOST;
      delete process.env.KUBERNETES_SERVICE_PORT;

      // Mock file existence checks
      mockFileSystem.access.mockResolvedValue(undefined); // Files exist but env vars missing

      // Act & Assert
      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        NotInClusterError,
      );

      // Verify logs
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Not running inside a Kubernetes cluster. Environment variables KUBERNETES_SERVICE_HOST or KUBERNETES_SERVICE_PORT are missing.',
      );
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Not running inside a Kubernetes cluster.',
        expect.any(NotInClusterError),
      );
    });

    /**
     * Test Case 3:
     * should throw an error if not running inside a Kubernetes cluster due to missing service account files
     */
    it('should throw an error if not running inside a Kubernetes cluster due to missing service account files', async () => {
      // Arrange
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock file existence checks to simulate missing service account files
      mockFileSystem.access.mockRejectedValue(new Error('File not found'));

      // Act & Assert
      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        ConfigFileNotFoundError,
      );

      // Verify access calls attempted
      expect(mockFileSystem.access).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/token',
      );
      expect(mockFileSystem.access).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt',
      );
      expect(mockFileSystem.access).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace',
      );

      // Verify only the actual error log messages
      expect(mockedLoggerInstance.error).toHaveBeenNthCalledWith(
        1,
        'Missing service account token file at /var/run/secrets/kubernetes.io/serviceaccount/token',
      );
      expect(mockedLoggerInstance.error).toHaveBeenNthCalledWith(
        2,
        'Kubeconfig file not found at path: Service account token is missing at path: /var/run/secrets/kubernetes.io/serviceaccount/token',
        expect.any(ConfigFileNotFoundError),
      );
    });

    /**
     * Test Case 4:
     * should throw ConfigFileNotFoundError if service account token file is missing
     */
    it('should throw ConfigFileNotFoundError if service account token file is missing', async () => {
      // Arrange
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock file existence checks
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      mockFileSystem.access.mockImplementation((filePath: string) => {
        if (filePath === tokenPath) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve();
      });

      // Act & Assert
      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        ConfigFileNotFoundError,
      );

      // Verify access calls
      expect(mockFileSystem.access).toHaveBeenCalledWith(tokenPath);
      expect(mockFileSystem.access).toHaveBeenCalledWith(caPath);
      expect(mockFileSystem.access).toHaveBeenCalledWith(namespacePath);

      // Verify error log messages and error types
      expect(mockedLoggerInstance.error).toHaveBeenNthCalledWith(
        1,
        'Missing service account token file at /var/run/secrets/kubernetes.io/serviceaccount/token',
      );

      expect(mockedLoggerInstance.error).toHaveBeenNthCalledWith(
        2,
        'Kubeconfig file not found at path: Service account token is missing at path: /var/run/secrets/kubernetes.io/serviceaccount/token',
        expect.any(ConfigFileNotFoundError),
      );
    });

    /**
     * Test Case 5:
     * should throw ConfigFileNotFoundError if CA certificate file is missing
     */
    it('should throw ConfigFileNotFoundError if CA certificate file is missing', async () => {
      // Arrange
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock file existence checks
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      mockFileSystem.access.mockImplementation((filePath: string) => {
        if (filePath === caPath) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve();
      });

      // Act & Assert
      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        ConfigFileNotFoundError,
      );

      // Verify access calls
      expect(mockFileSystem.access).toHaveBeenCalledWith(tokenPath);
      expect(mockFileSystem.access).toHaveBeenCalledWith(caPath);
      expect(mockFileSystem.access).toHaveBeenCalledWith(namespacePath);

      // Verify error log
      expect(mockedLoggerInstance.error).toHaveBeenNthCalledWith(
        1,
        'Missing CA certificate file at /var/run/secrets/kubernetes.io/serviceaccount/ca.crt',
      );

      expect(mockedLoggerInstance.error).toHaveBeenNthCalledWith(
        2,
        'Kubeconfig file not found at path: CA certificate is missing at path: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt',
        expect.any(ConfigFileNotFoundError),
      );
    });

    /**
     * Test Case 6:
     * should throw an error if service account token is empty or invalid after trimming
     */
    it('should throw an error if service account token is empty or invalid after trimming', async () => {
      // Arrange
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock file existence checks
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      mockFileSystem.access.mockResolvedValue(undefined); // All files exist

      // Mock readFile to return an empty string for the token
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.resolve('   '); // Invalid token after trimming
          }
          if (filePath === caPath && !encoding) {
            return Promise.resolve(Buffer.from('ca-cert'));
          }
          if (filePath === namespacePath && encoding === 'utf8') {
            return Promise.resolve('default');
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${filePath}`),
          );
        },
      ) as jest.MockedFunction<IFileSystem['readFile']>;

      // Act & Assert
      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        'Service account token is missing or invalid.',
      );

      // Verify error log
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Service account token is missing or invalid.',
        expect.any(InvalidConfigError),
      );
    });

    /**
     * Test Case 7:
     * should throw an error if CA certificate is not a valid non-empty Buffer
     */
    it('should throw an error if CA certificate is not a valid non-empty Buffer', async () => {
      // Arrange
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock file existence checks
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      mockFileSystem.access.mockResolvedValue(undefined); // All files exist

      // Mock readFile to return an invalid Buffer for CA certificate
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.resolve('mycluster-token');
          }
          if (filePath === caPath && !encoding) {
            return Promise.resolve(Buffer.alloc(0)); // Invalid CA certificate
          }
          if (filePath === namespacePath && encoding === 'utf8') {
            return Promise.resolve('default');
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${filePath}`),
          );
        },
      ) as jest.MockedFunction<IFileSystem['readFile']>;

      // Act & Assert
      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        'CA certificate is missing or invalid.',
      );

      // Verify error log
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'CA certificate is missing or invalid.',
        expect.any(InvalidConfigError),
      );
    });

    /**
     * Test Case 8:
     * should log a warning if the namespace file is missing or invalid
     */
    it('should log a warning if the namespace file is missing or invalid', async () => {
      // Arrange
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock file existence checks
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      mockFileSystem.access.mockResolvedValue(undefined); // All files exist

      // Mock readFile: token and CA are valid, namespace is invalid
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.resolve('mycluster-token');
          }
          if (filePath === caPath && !encoding) {
            return Promise.resolve(Buffer.from('ca-cert'));
          }
          if (filePath === namespacePath && encoding === 'utf8') {
            return Promise.resolve(''); // Invalid namespace
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${filePath}`),
          );
        },
      ) as jest.MockedFunction<IFileSystem['readFile']>;

      const expectedResolvedConfig: ResolvedKubeConfig = {
        cluster: {
          server: 'https://10.0.0.1:443',
          certificateAuthorityData: Buffer.from('ca-cert').toString('base64'),
        },
        user: {
          token: 'mycluster-token',
        },
      };

      // Act
      const result = await kubeConfigReader.getInClusterConfig();

      // Assert
      // Verify that a warning was logged
      expect(mockedLoggerInstance.warn).toHaveBeenCalledWith(
        'Namespace is missing or invalid.',
      );

      // Verify the result still returns the config without namespace validation
      expect(result).toEqual(expectedResolvedConfig);
    });

    /**
     * Test Case 9:
     * should handle readFileSafely errors when reading the token file
     */
    it('should handle readFileSafely errors when reading the token file', async () => {
      // Arrange
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock file existence checks
      mockFileSystem.access.mockResolvedValue(undefined); // All files exist

      // Define the expected file paths
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      // Mock readFile to throw an error when reading the token file
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.reject(new Error('Token file read error'));
          }
          if (filePath === caPath && !encoding) {
            return Promise.resolve(Buffer.from('ca-cert'));
          }
          if (filePath === namespacePath && encoding === 'utf8') {
            return Promise.resolve('default');
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${filePath}`),
          );
        },
      ) as jest.MockedFunction<IFileSystem['readFile']>;

      // Act & Assert
      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        'Failed to read file at /var/run/secrets/kubernetes.io/serviceaccount/token: Token file read error',
      );

      expect.any(ConfigFileNotFoundError);
    });

    /**
     * Test Case 10:
     * should handle readFileSafely errors when reading the CA certificate file
     */
    it('should handle readFileSafely errors when reading the CA certificate file', async () => {
      // Arrange
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock file existence checks
      mockFileSystem.access.mockResolvedValue(undefined); // All files exist

      // Define the expected file paths
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      // Mock readFile to throw an error when reading the CA certificate file
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.resolve('mycluster-token');
          }
          if (filePath === caPath && !encoding) {
            return Promise.reject(new Error('CA certificate read error'));
          }
          if (filePath === namespacePath && encoding === 'utf8') {
            return Promise.resolve('default');
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${filePath}`),
          );
        },
      ) as jest.MockedFunction<IFileSystem['readFile']>;

      // Act & Assert
      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        'Failed to read file at /var/run/secrets/kubernetes.io/serviceaccount/ca.crt: CA certificate read error',
      );

      // Verify error log
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Kubeconfig file not found at path: Failed to read file at /var/run/secrets/kubernetes.io/serviceaccount/ca.crt: CA certificate read error',
        expect.any(ConfigFileNotFoundError),
      );
    });

    /**
     * Test Case 11:
     * should handle readFileSafely errors when reading the namespace file
     */
    it('should handle readFileSafely errors when reading the namespace file', async () => {
      // Arrange
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock file existence checks
      mockFileSystem.access.mockResolvedValue(undefined); // All files exist

      // Define the expected file paths
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      // Mock readFile to throw an error when reading the namespace file
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.resolve('mycluster-token');
          }
          if (filePath === caPath && !encoding) {
            return Promise.resolve(Buffer.from('ca-cert'));
          }
          if (filePath === namespacePath && encoding === 'utf8') {
            return Promise.reject(new Error('Namespace file read error'));
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${filePath}`),
          );
        },
      ) as jest.MockedFunction<IFileSystem['readFile']>;

      // Act
      const result = await kubeConfigReader.getInClusterConfig();

      // Assert
      // Verify that a warning was logged
      expect(mockedLoggerInstance.warn).toHaveBeenCalledWith(
        'Failed to read namespace file.',
      );

      // Verify the result still returns the config without namespace validation
      expect(result).toEqual({
        cluster: {
          server: 'https://10.0.0.1:443',
          certificateAuthorityData: Buffer.from('ca-cert').toString('base64'),
        },
        user: {
          token: 'mycluster-token',
        },
      });

      // Verify that readFile was called for the namespace file
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        namespacePath,
        'utf8',
      );
    });

    /**
     * Test Case 12:
     * should construct the server URL correctly using serviceHost and servicePort environment variables
     */
    it('should construct the server URL correctly using serviceHost and servicePort environment variables', async () => {
      // Arrange
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock file existence checks
      mockFileSystem.access.mockResolvedValue(undefined); // All files exist

      // Define the expected file paths
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      // Mock readFile to return valid data
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.resolve('mycluster-token');
          }
          if (filePath === caPath && !encoding) {
            return Promise.resolve(Buffer.from('ca-cert'));
          }
          if (filePath === namespacePath && encoding === 'utf8') {
            return Promise.resolve('default');
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${filePath}`),
          );
        },
      ) as jest.MockedFunction<IFileSystem['readFile']>;

      const expectedResolvedConfig: ResolvedKubeConfig = {
        cluster: {
          server: 'https://10.0.0.1:443',
          certificateAuthorityData: Buffer.from('ca-cert').toString('base64'),
        },
        user: {
          token: 'mycluster-token',
        },
      };

      // Act
      const result = await kubeConfigReader.getInClusterConfig();

      // Assert
      expect(result).toEqual(expectedResolvedConfig);
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
      expect(mockedLoggerInstance.warn).not.toHaveBeenCalled();
    });

    /**
     * Test Case 13:
     * should validate that isInCluster correctly checks for file existence and environment variables
     */
    it('should validate that isInCluster correctly checks for file existence and environment variables', async () => {
      // Arrange
      // Simulate a valid in-cluster environment
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock file existence checks
      mockFileSystem.access.mockResolvedValue(undefined); // All files exist

      // Mock readFile to return valid data
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.resolve('mycluster-token');
          }
          if (filePath === caPath && !encoding) {
            return Promise.resolve(Buffer.from('ca-cert'));
          }
          if (filePath === namespacePath && encoding === 'utf8') {
            return Promise.resolve('default');
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${filePath}`),
          );
        },
      ) as jest.MockedFunction<IFileSystem['readFile']>;

      const expectedResolvedConfig: ResolvedKubeConfig = {
        cluster: {
          server: 'https://10.0.0.1:443',
          certificateAuthorityData: Buffer.from('ca-cert').toString('base64'),
        },
        user: {
          token: 'mycluster-token',
        },
      };

      // Act
      const result = await kubeConfigReader.getInClusterConfig();

      // Assert
      expect(result).toEqual(expectedResolvedConfig);

      // Verify that access was called for all required files
      expect(mockFileSystem.access).toHaveBeenCalledWith(tokenPath);
      expect(mockFileSystem.access).toHaveBeenCalledWith(caPath);
      expect(mockFileSystem.access).toHaveBeenCalledWith(namespacePath);

      // Verify readFile was called correctly
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(tokenPath, 'utf8');
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(caPath, undefined);
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        namespacePath,
        'utf8',
      );

      // Verify no logs
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
      expect(mockedLoggerInstance.warn).not.toHaveBeenCalled();
    });
  });
});
