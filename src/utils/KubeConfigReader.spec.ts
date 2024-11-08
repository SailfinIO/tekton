// src/utils/KubeConfigReader.spec.ts

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

const MockedLogger = Logger as jest.MockedClass<typeof Logger>;
const mockedYamlParser = YamlParser as jest.Mocked<typeof YamlParser>;

const createMockFileSystem = (): jest.Mocked<IFileSystem> => ({
  readFile: jest.fn(),
  access: jest.fn(),
});

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
    mockedLoggerInstance.error = jest.fn();
    mockedLoggerInstance.warn = jest.fn();

    // Setup FileSystem mock
    mockFileSystem = {
      readFile: jest.fn(),
      access: jest.fn(),
      // Add other required methods
    } as jest.Mocked<IFileSystem>;

    // Setup YamlParser mock
    mockedYamlParser = {
      parse: jest.fn(),
    } as unknown as jest.Mocked<typeof YamlParser>;

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
      // Mock file content
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
      const mockKubeConfigPath = '/mock/.kube/config';
      // Mock FileSystem to return the kubeConfigContent
      mockFileSystem.readFile = jest
        .fn()
        .mockImplementation((path: string, encoding?: BufferEncoding) => {
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
        }) as jest.MockedFunction<IFileSystem['readFile']>;

      // Mock YamlParser.parse to return the parsed object
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
        currentContext: 'context1', // Adjusted to camelCase based on mapKeys
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

      const expectedResolvedConfig: ResolvedKubeConfig = {
        cluster: {
          server: 'https://1.2.3.4',
          certificateAuthorityData: 'abc123',
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
      expect(YamlParser.parse).toHaveBeenCalledWith(kubeConfigContent);
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
      // Mock file content with invalid YAML
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

      // Mock fs.readFile to return invalid YAML content
      mockFileSystem.readFile.mockResolvedValue(
        Buffer.from(invalidYamlContent),
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
      // Mock file content without current-context
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

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(kubeConfigContent));
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
      // Mock file content with invalid current-context
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

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(kubeConfigContent));
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
        currentContext: 'invalidContext',
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

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(kubeConfigContent));
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

      expect(mockedYamlParser.parse).toHaveBeenCalledWith(kubeConfigContent);
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        mockKubeConfigPath,
        'utf8',
      );
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

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(kubeConfigContent));
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

      expect(mockedYamlParser.parse).toHaveBeenCalledWith(kubeConfigContent);
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        mockKubeConfigPath,
        'utf8',
      );
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

      // Mock fs.promises.readFile to return token, CA, and namespace
      mockFileSystem.readFile.mockImplementation(
        async (filePath: string, encoding?: BufferEncoding) => {
          if (
            filePath === '/var/run/secrets/kubernetes.io/serviceaccount/token'
          ) {
            return Buffer.from('mycluster-token');
          } else if (
            filePath === '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
          ) {
            return Buffer.from('ca-cert');
          } else if (
            filePath ===
            '/var/run/secrets/kubernetes.io/serviceaccount/namespace'
          ) {
            return Buffer.from('default');
          }
          throw new Error('File not found');
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

      expect(mockFileSystem.access).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/token',
      );
      expect(mockFileSystem.access).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt',
      );
      expect(mockFileSystem.access).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace',
      );
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/token',
        'utf8',
      );
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt',
        null,
      );
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace',
        'utf8',
      );
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
      expect(mockedLoggerInstance.warn).not.toHaveBeenCalled();
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

      // Mock fs.promises.readFile to throw error when reading token
      const permissionError = new Error('Permission denied');
      (permissionError as any).code = 'EACCES';
      mockFileSystem.readFile.mockImplementation(
        async (filePath: string, encoding?: BufferEncoding) => {
          if (
            filePath === '/var/run/secrets/kubernetes.io/serviceaccount/token'
          ) {
            return Buffer.from('mycluster-token');
          } else if (
            filePath === '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
          ) {
            return Buffer.from('ca-cert');
          } else if (
            filePath ===
            '/var/run/secrets/kubernetes.io/serviceaccount/namespace'
          ) {
            return Buffer.from('default');
          }

          throw new Error('File not found');
        },
      );

      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        'In-cluster configuration loading failed: Failed to read file at /var/run/secrets/kubernetes.io/serviceaccount/token: Permission denied',
      );

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/token',
        'utf8',
      );
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

      // Mock fs.promises.readFile to return token, CA, and namespace

      mockFileSystem.readFile.mockImplementation(async (filePath: string) => {
        if (
          filePath === '/var/run/secrets/kubernetes.io/serviceaccount/token'
        ) {
          return Buffer.from('mycluster-token');
        } else if (
          filePath === '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
        ) {
          return Buffer.from('ca-cert');
        } else if (
          filePath === '/var/run/secrets/kubernetes.io/serviceaccount/namespace'
        ) {
          return Buffer.from('default');
        }

        throw new Error('File not found');
      });

      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        'In-cluster configuration loading failed: KUBERNETES_SERVICE_HOST or KUBERNETES_SERVICE_PORT environment variables are not set.',
      );

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/token',
        'utf8',
      );
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt',
        null,
      );
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace',
        'utf8',
      );
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'KUBERNETES_SERVICE_HOST or KUBERNETES_SERVICE_PORT environment variables are not set.',
      );
    });

    it('should throw an error and log if certificate authority data is invalid', async () => {
      // Mock environment variables to simulate in-cluster environment
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock fs.promises.access to return success for required files
      mockFileSystem.access.mockResolvedValue(undefined);

      // Mock fs.promises.readFile to return invalid CA data
      mockFileSystem.readFile.mockImplementation(async (filePath: string) => {
        if (
          filePath === '/var/run/secrets/kubernetes.io/serviceaccount/token'
        ) {
          return Buffer.from('mycluster-token');
        } else if (
          filePath === '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
        ) {
          return Buffer.from(''); // Invalid CA data
        } else if (
          filePath === '/var/run/secrets/kubernetes.io/serviceaccount/namespace'
        ) {
          return Buffer.from('default');
        }
        throw new Error('File not found');
      });

      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        'In-cluster configuration loading failed: CA certificate is missing or invalid.',
      );

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt',
        null,
      );
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'CA certificate is missing or invalid.',
      );
    });

    it('should throw an error and log if token is missing or invalid', async () => {
      // Mock environment variables to simulate in-cluster environment
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      // Mock fs.promises.access to return success for required files
      mockFileSystem.access.mockResolvedValue(undefined);

      // Define the specific file paths
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      // Mock fs.promises.readFile with conditional logic based on arguments

      mockFileSystem.readFile.mockImplementation(async (filePath: string) => {
        if (
          filePath === '/var/run/secrets/kubernetes.io/serviceaccount/token'
        ) {
          return Buffer.from('mycluster-token');
        } else if (
          filePath === '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
        ) {
          return Buffer.from('ca-cert');
        } else if (
          filePath === '/var/run/secrets/kubernetes.io/serviceaccount/namespace'
        ) {
          return Buffer.from('default');
        }

        throw new Error('File not found');
      });

      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        'In-cluster configuration loading failed: Service account token is missing or invalid.',
      );

      // Verify that readFile was called with the correct arguments
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(tokenPath, 'utf8');
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(caPath);
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        namespacePath,
        'utf8',
      );

      // Verify that the appropriate error was logged
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Service account token is missing or invalid.',
      );
    });
  });
});
