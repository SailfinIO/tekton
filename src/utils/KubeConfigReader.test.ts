// src/utils/KubeConfigReader.test.ts

import { IFileSystem } from '../interfaces';
import { KubeConfigReader } from './KubeConfigReader';
import { ResolvedKubeConfig } from '../models/ResolvedKubeConfig';
import { YamlParser } from './YamlParser';
import { Logger } from './Logger';
import {
  ConfigFileNotFoundError,
  InvalidConfigError,
  ParsingError,
} from '../errors';
import { LogLevel } from '../enums';

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
   * Test Cases for getKubeConfig
   */
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

      const mockKubeConfigPath = '/mock/.kube/config';
      // Mock FileSystem to return the kubeConfigContent
      mockFileSystem.readFile = jest
        .fn()
        .mockImplementation((path: string, encoding?: BufferEncoding) => {
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
        }) as jest.MockedFunction<IFileSystem['readFile']>;

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

    it('should throw ConfigFileNotFoundError if kubeconfig file does not exist', async () => {
      const mockKubeConfigPath = '/mock/.kube/config';

      const enoentError = new Error('File not found');
      (enoentError as any).code = 'ENOENT';
      mockFileSystem.readFile.mockRejectedValue(enoentError);

      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        ConfigFileNotFoundError,
      );

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        mockKubeConfigPath,
        'utf8',
      );
      // Ensure no additional logs are called since exception is thrown
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
      expect(mockedLoggerInstance.warn).not.toHaveBeenCalled();
    });

    it('should throw ParsingError if kubeconfig YAML is invalid', async () => {
      const mockKubeConfigPath = '/mock/.kube/config';
      const invalidYamlContent = `
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
        invalid_yaml_here
      `;

      // Update the mock to return invalid YAML content when 'utf8' is specified
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (path: string, encoding?: BufferEncoding): Promise<string | Buffer> => {
          if (encoding === 'utf8' && path === mockKubeConfigPath) {
            return Promise.resolve(invalidYamlContent); // Return string
          }
          return Promise.resolve(Buffer.from(invalidYamlContent)); // Return Buffer for other cases
        },
      );

      // Mock YamlParser.parse to throw SyntaxError
      mockedYamlParser.parse.mockImplementation(() => {
        throw new SyntaxError('Unexpected token');
      });

      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        ParsingError,
      );

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        mockKubeConfigPath,
        'utf8',
      );
      expect(YamlParser.parse).toHaveBeenCalledWith(invalidYamlContent);
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
      expect(mockedLoggerInstance.warn).not.toHaveBeenCalled();
    });

    it('should throw InvalidConfigError if currentContext is not set in kubeconfig', async () => {
      const mockKubeConfigPath = '/mock/.kube/config';
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
        users:
          - name: user1
            user:
              token: mytoken
      `;

      // Update the mock to return kubeConfigContent when 'utf8' is specified
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (path: string, encoding?: BufferEncoding): Promise<string | Buffer> => {
          if (encoding === 'utf8' && path === mockKubeConfigPath) {
            return Promise.resolve(kubeConfigContent); // Return string
          }
          return Promise.resolve(Buffer.from(kubeConfigContent)); // Return Buffer for other cases
        },
      );

      // Mock YamlParser.parse to return parsed config without currentContext
      const parsedConfig = {
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
        // currentContext is missing
        users: [
          {
            name: 'user1',
            user: {
              token: 'mytoken',
            },
          },
        ],
      };

      mockedYamlParser.parse.mockReturnValue(parsedConfig);

      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        InvalidConfigError,
      );

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        mockKubeConfigPath,
        'utf8',
      );
      expect(YamlParser.parse).toHaveBeenCalledWith(kubeConfigContent);
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        `No currentContext is set in kubeconfig.`,
      );
    });

    it('should return null and log an error if currentContext does not match any context', async () => {
      const mockKubeConfigPath = '/mock/.kube/config';
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
        current-context: invalidContext
        users:
          - name: user1
            user:
              token: mytoken
      `;

      // Update the mock to return kubeConfigContent when 'utf8' is specified
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (path: string, encoding?: BufferEncoding): Promise<string | Buffer> => {
          if (encoding === 'utf8' && path === mockKubeConfigPath) {
            return Promise.resolve(kubeConfigContent); // Return string
          }
          return Promise.resolve(Buffer.from(kubeConfigContent)); // Return Buffer for other cases
        },
      );

      // Mock YamlParser.parse to return parsed config with invalid currentContext
      const parsedConfig = {
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
        currentContext: 'invalidContext', // Adjusted to camelCase based on mapKeys
        users: [
          {
            name: 'user1',
            user: {
              token: 'mytoken',
            },
          },
        ],
      };

      mockedYamlParser.parse.mockReturnValue(parsedConfig);

      const result = await kubeConfigReader.getKubeConfig();

      expect(mockedYamlParser.parse).toHaveBeenCalledWith(kubeConfigContent);
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        mockKubeConfigPath,
        'utf8',
      );
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        `Context 'invalidContext' not found in kubeconfig.`,
      );
      expect(result).toBeNull();
    });

    it("should return null and log an error if context's cluster is not found", async () => {
      const mockKubeConfigPath = '/mock/.kube/config';
      // Mock file content where cluster is missing
      const kubeConfigContent = `
        apiVersion: v1
        clusters:
          - cluster:
              server: https://1.2.3.4
              certificate-authority-data: abc123
            name: cluster1
        contexts:
          - context:
              cluster: missingCluster
              user: user1
            name: context1
        current-context: context1
        users:
          - name: user1
            user:
              token: mytoken
      `;

      // Update the mock to return kubeConfigContent when 'utf8' is specified
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (path: string, encoding?: BufferEncoding): Promise<string | Buffer> => {
          if (encoding === 'utf8' && path === mockKubeConfigPath) {
            return Promise.resolve(kubeConfigContent); // Return string
          }
          return Promise.resolve(Buffer.from(kubeConfigContent)); // Return Buffer for other cases
        },
      );

      // Mock YamlParser.parse to return parsed config with missing cluster
      const parsedConfig = {
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
              cluster: 'missingCluster',
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

      mockedYamlParser.parse.mockReturnValue(parsedConfig);

      const result = await kubeConfigReader.getKubeConfig();

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        mockKubeConfigPath,
        'utf8',
      );
      expect(YamlParser.parse).toHaveBeenCalledWith(kubeConfigContent);
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        `Cluster 'missingCluster' not found in kubeconfig.`,
      );
      expect(result).toBeNull();
    });

    it("should return null and log an error if context's user is not found", async () => {
      const mockKubeConfigPath = '/mock/.kube/config';
      // Mock file content where user is missing
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
              user: missingUser
            name: context1
        current-context: context1
        users:
          - name: user1
            user:
              token: mytoken
      `;

      // Update the mock to return kubeConfigContent when 'utf8' is specified
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (path: string, encoding?: BufferEncoding): Promise<string | Buffer> => {
          if (encoding === 'utf8' && path === mockKubeConfigPath) {
            return Promise.resolve(kubeConfigContent); // Return string
          }
          return Promise.resolve(Buffer.from(kubeConfigContent)); // Return Buffer for other cases
        },
      );

      // Mock YamlParser.parse to return parsed config with missing user
      const parsedConfig = {
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
              user: 'missingUser',
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

      mockedYamlParser.parse.mockReturnValue(parsedConfig);

      const result = await kubeConfigReader.getKubeConfig();

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        mockKubeConfigPath,
        'utf8',
      );
      expect(YamlParser.parse).toHaveBeenCalledWith(kubeConfigContent);
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        `User 'missingUser' not found in kubeconfig.`,
      );
      expect(result).toBeNull();
    });

    it('should throw a generic Error if kubeconfig file read fails for reasons other than ENOENT', async () => {
      const mockKubeConfigPath = '/mock/.kube/config';
      // Mock fs.readFile to throw a generic error
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
        `Unexpected error: Permission denied`,
      );
    });

    it('should throw a generic Error if kubeconfig file read fails for reasons other than ENOENT', async () => {
      const mockKubeConfigPath = '/mock/.kube/config';
      // Mock fs.readFile to throw a generic error
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
        `Unexpected error: Permission denied`,
      );
    });
  });

  /**
   * Test Cases for getInClusterConfig
   */
  describe('getInClusterConfig', () => {
    it('should successfully read in-cluster config and return ResolvedKubeConfig', async () => {
      // Mock environment variables to simulate in-cluster environment
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock fs.promises.access to return success for required files
      mockFileSystem.access.mockResolvedValue(undefined);

      // Define the expected file paths
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      // Mock fs.promises.readFile based on arguments
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (path: string, encoding?: BufferEncoding): Promise<string | Buffer> => {
          switch (path) {
            case tokenPath:
              return Promise.resolve('mycluster-token');
            case caPath:
              return Promise.resolve(Buffer.from('ca-cert'));
            case namespacePath:
              return Promise.resolve('default');
            default:
              return Promise.reject(
                new Error(`Unexpected readFile call with path: ${path}`),
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

      const result = await kubeConfigReader.getInClusterConfig();

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

    it('should throw an error and log if not running inside a Kubernetes cluster', async () => {
      // Mock environment variables to simulate non-cluster environment
      delete process.env.KUBERNETES_SERVICE_HOST;
      delete process.env.KUBERNETES_SERVICE_PORT;

      // Mock fs.promises.access to throw for one or more required files
      const enoentError = new Error('File not found');
      (enoentError as any).code = 'ENOENT';
      mockFileSystem.access.mockRejectedValue(enoentError);

      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        'In-cluster configuration loading failed: KUBERNETES_SERVICE_HOST or KUBERNETES_SERVICE_PORT environment variables are not set.',
      );

      expect(mockFileSystem.access).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/token',
      );
      expect(mockFileSystem.access).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt',
      );
      expect(mockFileSystem.access).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace',
      );
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Not running inside a Kubernetes cluster.',
      );
    });

    it('should throw an error and log if reading token file fails', async () => {
      // Mock environment variables to simulate in-cluster environment
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock fs.promises.access to return success for required files
      mockFileSystem.access.mockResolvedValue(undefined);

      // Define the expected file paths
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      // Mock fs.promises.readFile with conditional logic based on arguments
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (
          filePath: string,
          encoding?: BufferEncoding,
        ): Promise<string | Buffer> => {
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.reject(new Error('Permission denied')); // Simulate read error
          } else if (filePath === caPath && !encoding) {
            return Promise.resolve(Buffer.from('ca-cert')); // Buffer
          } else if (filePath === namespacePath && encoding === 'utf8') {
            return Promise.resolve('default'); // string
          }
          return Promise.resolve(Buffer.from('ca-cert')); // Buffer
        },
      );

      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        'In-cluster configuration loading failed: Failed to read file at /var/run/secrets/kubernetes.io/serviceaccount/token: Permission denied',
      );

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(tokenPath, 'utf8');
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Failed to read file at /var/run/secrets/kubernetes.io/serviceaccount/token: Permission denied',
      );
    });

    it('should throw an error and log if required environment variables are missing', async () => {
      // Mock environment variables to simulate missing service host/port
      process.env.KUBERNETES_SERVICE_HOST = '';
      process.env.KUBERNETES_SERVICE_PORT = '';

      // Mock fs.promises.access to return success for required files
      mockFileSystem.access.mockResolvedValue(undefined);

      // Define the expected file paths
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      // Mock fs.promises.readFile to return token, CA, and namespace
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (
          filePath: string,
          encoding?: BufferEncoding,
        ): Promise<string | Buffer> => {
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.resolve('mycluster-token'); // string
          } else if (filePath === caPath && !encoding) {
            return Promise.resolve(Buffer.from('ca-cert')); // Buffer
          } else if (filePath === namespacePath && encoding === 'utf8') {
            return Promise.resolve('default'); // string
          }
          return Promise.resolve(Buffer.from('ca-cert')); // Buffer
        },
      );

      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        'In-cluster configuration loading failed: KUBERNETES_SERVICE_HOST or KUBERNETES_SERVICE_PORT environment variables are not set.',
      );

      expect(mockFileSystem.readFile).not.toHaveBeenCalledWith(
        tokenPath,
        'utf8',
      );
      expect(mockFileSystem.readFile).not.toHaveBeenCalledWith(caPath);
      expect(mockFileSystem.readFile).not.toHaveBeenCalledWith(
        namespacePath,
        'utf8',
      );
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Not running inside a Kubernetes cluster.',
      );
      expect(mockedLoggerInstance.error).toHaveBeenNthCalledWith(
        1,
        'Not running inside a Kubernetes cluster.',
      );
      expect(mockedLoggerInstance.error).toHaveBeenNthCalledWith(
        2,
        'Failed to load in-cluster configuration',
        new Error(
          'KUBERNETES_SERVICE_HOST or KUBERNETES_SERVICE_PORT environment variables are not set.',
        ),
      );
    });

    it('should throw an error and log if CA certificate data is empty', async () => {
      // Arrange
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';
      mockFileSystem.access.mockResolvedValue(undefined);

      // Define the expected file paths
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      // Mock readFile to return valid token and namespace, but empty Buffer for CA cert
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.resolve('mycluster-token');
          }
          if (filePath === caPath && !encoding) {
            return Promise.resolve(Buffer.alloc(0)); // Empty Buffer
          }
          if (filePath === namespacePath && encoding === 'utf8') {
            return Promise.resolve('default');
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${filePath}`),
          );
        },
      );

      // Act & Assert
      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        'In-cluster configuration loading failed: CA certificate data is empty.',
      );

      // Verify logs
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'CA certificate data is empty.',
      );
    });

    it('should throw an error and log if token is missing or invalid', async () => {
      // Arrange
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';
      mockFileSystem.access.mockResolvedValue(undefined);

      // Define the expected file paths
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      // Mock readFile to return an empty string for the token
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.resolve(''); // Invalid token
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
      );

      // Act & Assert
      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        'Service account token is missing or invalid.',
      );

      // Verify logs
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Service account token is missing or invalid.',
      );
    });
  });
});
