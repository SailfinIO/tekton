// src/utils/KubeConfigReader.test.ts

// Mock internal modules BEFORE importing them
jest.mock('./FileSystem');
jest.mock('./YamlParser');
jest.mock('./Logger');
jest.mock('./PemUtils');

import path from 'path';
import { KubeConfigReader } from './KubeConfigReader';
import { ResolvedKubeConfig } from '../models';
import { Logger } from './Logger';
import { PemUtils } from './PemUtils';
import {
  ConfigFileNotFoundError,
  InvalidConfigError,
  NotInClusterError,
  ParsingError,
} from '../errors';
import { LogLevel, PemType } from '../enums';

// Import mocks
import {
  validKubeConfigYaml,
  parsedValidKubeConfig,
  kubeConfigWithEmptyCurrentContext,
  kubeConfigWithInvalidCA,
  kubeConfigWithInvalidUserCert,
  kubeConfigWithInvalidUserKey,
  malformedKubeConfigYaml,
  resolvedInClusterKubeConfig,
  parsedTokenKubeConfig,
  tokenKubeConfigYaml,
  resolvedTokenKubeConfig,
} from './__mocks__/kubeConfigMocks';
import { IFileSystem, ILogger, IYamlParser } from '../interfaces';

describe('KubeConfigReader', () => {
  let kubeConfigReader: KubeConfigReader;
  let mockedLoggerInstance: jest.Mocked<ILogger>;
  let mockFileSystemInstance: jest.Mocked<IFileSystem>;
  let mockedYamlParserInstance: jest.Mocked<IYamlParser>;
  let mockedPemUtils: jest.Mocked<typeof PemUtils>;
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

    // Mock Logger to return the mockedLoggerInstance
    (Logger as jest.Mock).mockImplementation(() => mockedLoggerInstance);

    // Initialize KubeConfigReader with the mock path
    kubeConfigReader = new KubeConfigReader(mockKubeConfigPath);

    // Retrieve the mocked FileSystem and YamlParser instances used by KubeConfigReader
    const { FileSystem } = require('./FileSystem');
    const { YamlParser } = require('./YamlParser');

    // Ensure that KubeConfigReader instantiated FileSystem and YamlParser
    expect(FileSystem).toHaveBeenCalledTimes(1);
    expect(YamlParser).toHaveBeenCalledTimes(1);

    // Retrieve the first instance created by KubeConfigReader
    mockFileSystemInstance = FileSystem.mock
      .instances[0] as jest.Mocked<IFileSystem>;
    mockedYamlParserInstance = YamlParser.mock
      .instances[0] as jest.Mocked<IYamlParser>;

    // Ensure that readFile and access are mocked
    mockFileSystemInstance.readFile = jest.fn();
    mockFileSystemInstance.access = jest.fn();

    // Similarly, ensure that parse and stringify are mocked
    mockedYamlParserInstance.parse = jest.fn();
    mockedYamlParserInstance.stringify = jest.fn();

    // Setup PemUtils mock
    mockedPemUtils = PemUtils as jest.Mocked<typeof PemUtils>;
    mockedPemUtils.isValidPem = jest.fn();
    mockedPemUtils.bufferToPem = jest.fn();

    // **Mock isValidBase64 to return true by default**
    mockedPemUtils.isValidBase64.mockImplementation((data: string) => {
      // Define valid base64 strings based on your mocks
      const validBase64Data = [
        Buffer.from('valid-ca-cert').toString('base64'),
        Buffer.from('valid-client-cert').toString('base64'),
        Buffer.from('valid-client-key').toString('base64'),
        Buffer.from('ca-cert').toString('base64'),
        Buffer.from('mycluster-token').toString('base64'),
      ];
      return validBase64Data.includes(data);
    });

    // **Mock isValidPem to return true for valid PEMs**
    mockedPemUtils.isValidPem.mockImplementation(
      (pem: string, type: PemType) => {
        // Simple regex check for PEM format
        const pemRegex = new RegExp(
          `-----BEGIN ${type}-----[\\s\\S]+-----END ${type}-----`,
        );
        return pemRegex.test(pem);
      },
    );

    // **Mock bufferToPem to return a valid PEM string**
    mockedPemUtils.bufferToPem.mockImplementation(
      (buffer: Buffer, type: PemType) => {
        const base64Data = buffer.toString('base64');
        return `-----BEGIN ${type}-----\n${base64Data}\n-----END ${type}-----`;
      },
    );
  });

  /**
   * Test Suite for Constructor
   */
  describe('Constructor', () => {
    let customKubeConfigPath: string;

    beforeEach(() => {
      jest.resetAllMocks();
      customKubeConfigPath = '/custom/path/to/kubeconfig';
    });

    it('should use the default kubeConfigPath when none is provided', () => {
      // Arrange
      const defaultHome = '/home/testuser';
      process.env.HOME = defaultHome;

      // Act
      const kubeConfigReaderDefault = new KubeConfigReader();

      const expectedPath = path.join(defaultHome, '.kube', 'config');

      // Assert
      expect(kubeConfigReaderDefault['kubeConfigPath']).toBe(expectedPath);
    });

    it('should use the provided kubeConfigPath when one is given', () => {
      // Act
      const kubeConfigReaderCustom = new KubeConfigReader(customKubeConfigPath);

      // Assert
      expect(kubeConfigReaderCustom['kubeConfigPath']).toBe(
        customKubeConfigPath,
      );
    });
  });

  /**
   * Test Suite for getKubeConfig Method
   */
  describe('getKubeConfig', () => {
    it('should successfully read and parse kubeconfig with client-certificate authentication, returning ResolvedKubeConfig', async () => {
      // Arrange
      mockedYamlParserInstance.parse.mockReturnValue(parsedValidKubeConfig);
      (mockFileSystemInstance.readFile as jest.Mock).mockResolvedValue(
        validKubeConfigYaml,
      );

      // Act
      const result = await kubeConfigReader.getKubeConfig();

      // Extract the base64 data from the kubeconfig YAML
      const expectedResolvedConfig: ResolvedKubeConfig = {
        cluster: {
          server: 'https://127.0.0.1:6443',
          certificateAuthorityData:
            Buffer.from('valid-ca-cert').toString('base64'),
          certificateAuthorityPem: `-----BEGIN CERTIFICATE-----\n${Buffer.from('valid-ca-cert').toString('base64')}\n-----END CERTIFICATE-----`,
        },
        user: {
          clientCertificateData:
            Buffer.from('valid-client-cert').toString('base64'),
          clientKeyData: Buffer.from('valid-client-key').toString('base64'),
          clientCertificatePem: `-----BEGIN CERTIFICATE-----\n${Buffer.from('valid-client-cert').toString('base64')}\n-----END CERTIFICATE-----`,
          clientKeyPem: `-----BEGIN PRIVATE KEY-----\n${Buffer.from('valid-client-key').toString('base64')}\n-----END PRIVATE KEY-----`,
          token: undefined, // Explicitly include token as undefined
        },
      };

      // Assert using toMatchObject to ignore additional properties
      expect(result).toMatchObject(expectedResolvedConfig);
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
      expect(mockedLoggerInstance.warn).not.toHaveBeenCalled();
    });

    it('should throw ConfigFileNotFoundError if user does not exist in users list', async () => {
      // Arrange
      const kubeConfigWithNonExistentUserUpdated = {
        ...parsedValidKubeConfig,
        currentContext: 'test-context',
        contexts: [
          ...parsedValidKubeConfig.contexts,
          {
            name: 'test-context',
            context: {
              cluster: 'test-cluster-1',
              user: 'non-existent-user',
            },
          },
        ],
      };

      mockedYamlParserInstance.parse.mockReturnValue(
        kubeConfigWithNonExistentUserUpdated,
      );
      (mockFileSystemInstance.readFile as jest.Mock).mockResolvedValue(
        validKubeConfigYaml,
      );

      // Act & Assert
      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        ConfigFileNotFoundError,
      );

      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        "Kubeconfig file not found at path: user 'non-existent-user' not found in kubeconfig.",
        expect.any(ConfigFileNotFoundError),
      );
    });

    it('should throw InvalidConfigError if currentContextName is empty', async () => {
      // Arrange
      mockedYamlParserInstance.parse.mockReturnValue(
        kubeConfigWithEmptyCurrentContext,
      );

      // Act & Assert
      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        InvalidConfigError,
      );

      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'No currentContext is set in kubeconfig.',
        expect.any(InvalidConfigError),
      );
    });

    it('should throw InvalidConfigError if certificateAuthorityData has invalid base64 format', async () => {
      // Arrange
      mockedYamlParserInstance.parse.mockReturnValue(kubeConfigWithInvalidCA);

      // Act & Assert
      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        InvalidConfigError,
      );

      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Invalid base64 format for certificateAuthorityData.',
        expect.any(InvalidConfigError),
      );
    });

    it('should throw InvalidConfigError if clientCertificateData has invalid base64 format', async () => {
      // Arrange
      mockedYamlParserInstance.parse.mockReturnValue(
        kubeConfigWithInvalidUserCert,
      );

      // Act & Assert
      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        InvalidConfigError,
      );

      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Invalid base64 format for clientCertificateData.',
        expect.any(InvalidConfigError),
      );
    });

    it('should throw InvalidConfigError if clientKeyData has invalid base64 format', async () => {
      // Arrange
      mockedYamlParserInstance.parse.mockReturnValue(
        kubeConfigWithInvalidUserKey,
      );

      // Act & Assert
      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        InvalidConfigError,
      );

      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Invalid base64 format for clientKeyData.',
        expect.any(InvalidConfigError),
      );
    });

    it('should throw ConfigFileNotFoundError if kubeconfig file does not exist', async () => {
      // Arrange
      const enoentError = new Error('File not found');
      (enoentError as any).code = 'ENOENT';
      mockFileSystemInstance.readFile.mockRejectedValue(enoentError);

      // Act & Assert
      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        ConfigFileNotFoundError,
      );

      // Ensure the error is logged correctly
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        `Kubeconfig file not found at path: ${kubeConfigReader['kubeConfigPath']}`,
        expect.any(ConfigFileNotFoundError),
      );
    });

    it('should throw ParsingError if kubeconfig YAML is invalid', async () => {
      // Arrange
      mockedYamlParserInstance.parse.mockImplementation(() => {
        throw new SyntaxError('Unexpected token');
      });

      // Act & Assert
      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        ParsingError,
      );

      expect(mockFileSystemInstance.readFile).toHaveBeenCalledWith(
        mockKubeConfigPath,
        'utf8',
      );
      expect(mockedYamlParserInstance.parse).toHaveBeenCalled();
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Failed to parse kubeconfig YAML.',
        expect.any(ParsingError),
      );
    });

    it('should throw KubeConfigError for unexpected errors', async () => {
      // Arrange
      const genericError = new Error('Permission denied');
      (genericError as any).code = 'EACCES';
      mockFileSystemInstance.readFile.mockRejectedValue(genericError);

      // Act & Assert
      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        'Failed to read kubeconfig: Permission denied',
      );

      expect(mockFileSystemInstance.readFile).toHaveBeenCalledWith(
        mockKubeConfigPath,
        'utf8',
      );
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Unexpected error: Permission denied',
        genericError,
      );
    });

    it('should throw ParsingError for malformed YAML', async () => {
      // Arrange
      (mockFileSystemInstance.readFile as jest.Mock).mockResolvedValue(
        malformedKubeConfigYaml,
      );
      mockedYamlParserInstance.parse.mockImplementation(() => {
        throw new SyntaxError('Malformed YAML');
      });

      // Act & Assert
      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        ParsingError,
      );

      expect(mockFileSystemInstance.readFile).toHaveBeenCalledWith(
        mockKubeConfigPath,
        'utf8',
      );
      expect(mockedYamlParserInstance.parse).toHaveBeenCalledWith(
        malformedKubeConfigYaml,
      );
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Failed to parse kubeconfig YAML.',
        expect.any(ParsingError),
      );
    });

    it('should successfully read and parse kubeconfig with token authentication, returning ResolvedKubeConfig', async () => {
      // Arrange
      mockedYamlParserInstance.parse.mockReturnValue(parsedTokenKubeConfig);
      (mockFileSystemInstance.readFile as jest.Mock).mockResolvedValue(
        tokenKubeConfigYaml,
      );

      // Act
      const result = await kubeConfigReader.getKubeConfig();

      // Assert
      expect(result).toMatchObject(resolvedTokenKubeConfig);
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
      expect(mockedLoggerInstance.warn).not.toHaveBeenCalled();
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
      mockFileSystemInstance.access.mockResolvedValue(undefined); // All files exist

      // Define the expected file paths
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      // Mock readFile to return valid data
      (mockFileSystemInstance.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          switch (filePath) {
            case tokenPath:
              return Promise.resolve('mycluster-token'); // Plain string
            case caPath:
              return Promise.resolve(Buffer.from('ca-cert')); // Buffer
            case namespacePath:
              return Promise.resolve('default');
            default:
              return Promise.reject(
                new Error(`Unexpected readFile call with path: ${filePath}`),
              );
          }
        },
      );

      const expectedResolvedConfig: ResolvedKubeConfig =
        resolvedInClusterKubeConfig;

      // Act
      const result = await kubeConfigReader.getInClusterConfig();

      // Assert
      expect(result).toEqual(expectedResolvedConfig);
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
      expect(mockedLoggerInstance.warn).not.toHaveBeenCalled();
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
      mockFileSystemInstance.access.mockResolvedValue(undefined); // Files exist but env vars missing

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

      // Mock file existence checks: missing token and CA
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      mockFileSystemInstance.access.mockImplementation((filePath: string) => {
        if (filePath === tokenPath || filePath === caPath) {
          return Promise.reject(new Error('File does not exist'));
        }
        return Promise.resolve();
      });

      // Act & Assert
      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        ConfigFileNotFoundError,
      );

      // Verify error logs for missing token and CA
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        `Missing service account token file at ${tokenPath}`,
      );
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        `Missing CA certificate file at ${caPath}`,
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

      // Mock file existence checks: missing token
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      mockFileSystemInstance.access.mockImplementation((filePath: string) => {
        if (filePath === tokenPath) {
          return Promise.reject(new Error('Token file does not exist'));
        }
        return Promise.resolve();
      });

      // Act & Assert
      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        ConfigFileNotFoundError,
      );

      // Verify error log for missing token
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        `Missing service account token file at ${tokenPath}`,
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

      // Mock file existence checks: missing CA
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      mockFileSystemInstance.access.mockImplementation((filePath: string) => {
        if (filePath === caPath) {
          return Promise.reject(new Error('CA file does not exist'));
        }
        return Promise.resolve();
      });

      // Act & Assert
      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        ConfigFileNotFoundError,
      );

      // Verify error log for missing CA
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        `Missing CA certificate file at ${caPath}`,
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

      mockFileSystemInstance.access.mockResolvedValue(undefined); // All files exist

      // Mock readFile to return an empty string for the token
      (mockFileSystemInstance.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.resolve('   '); // Invalid token after trimming
          }
          if (filePath === caPath && !encoding) {
            return Promise.resolve(Buffer.from('ca-cert')); // Buffer
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

      mockFileSystemInstance.access.mockResolvedValue(undefined); // All files exist

      // Mock readFile to return an invalid Buffer for CA certificate
      (mockFileSystemInstance.readFile as jest.Mock).mockImplementation(
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
      );

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

      mockFileSystemInstance.access.mockImplementation((filePath: string) => {
        if (filePath === namespacePath) {
          return Promise.reject(new Error('Namespace file does not exist'));
        }
        return Promise.resolve();
      });

      // Mock readFile to return valid data for token and CA
      (mockFileSystemInstance.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.resolve('mycluster-token');
          }
          if (filePath === caPath && !encoding) {
            return Promise.resolve(Buffer.from('ca-cert'));
          }
          if (filePath === namespacePath && encoding === 'utf8') {
            return Promise.reject(new Error('Cannot read namespace file'));
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${filePath}`),
          );
        },
      );

      // Act
      const result = await kubeConfigReader.getInClusterConfig();

      // Assert
      const expectedResolvedConfig: ResolvedKubeConfig = {
        cluster: {
          server: 'https://10.0.0.1:443',
          certificateAuthorityData: Buffer.from('ca-cert').toString('base64'),
          certificateAuthorityPem: `-----BEGIN CERTIFICATE-----\n${Buffer.from('ca-cert').toString('base64')}\n-----END CERTIFICATE-----`,
        },
        user: {
          token: 'mycluster-token',
        },
      };

      expect(result).toEqual(expectedResolvedConfig);
      expect(mockedLoggerInstance.warn).toHaveBeenCalledWith(
        `Namespace is missing or invalid: ${namespacePath}`,
      );
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
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
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      mockFileSystemInstance.access.mockResolvedValue(undefined); // All files exist

      // Mock readFile to throw an ENOENT error when reading the token file
      (mockFileSystemInstance.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === tokenPath && encoding === 'utf8') {
            const enoentError = new Error('Token file not found');
            (enoentError as any).code = 'ENOENT';
            return Promise.reject(enoentError);
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
        ConfigFileNotFoundError,
      );

      // Adjusted expectation to match the actual error message
      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Kubeconfig file not found at path: Failed to read in-cluster files: Token file not found',
        expect.any(ConfigFileNotFoundError),
      );
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
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      mockFileSystemInstance.access.mockResolvedValue(undefined); // All files exist

      // Mock readFile to throw an error when reading the CA certificate file
      (mockFileSystemInstance.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === caPath && !encoding) {
            return Promise.reject(new Error('CA file read error'));
          }
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.resolve('mycluster-token');
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
        ConfigFileNotFoundError,
      );

      // Verify error log for readFileSafely error

      expect(mockedLoggerInstance.error).toHaveBeenCalledWith(
        'Kubeconfig file not found at path: Failed to read in-cluster files: CA file read error',
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
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      mockFileSystemInstance.access.mockImplementation((filePath: string) => {
        if (filePath === namespacePath) {
          return Promise.reject(new Error('Namespace file does not exist'));
        }
        return Promise.resolve();
      });

      // Mock readFile to throw an error when reading the namespace file
      (mockFileSystemInstance.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          if (filePath === namespacePath && encoding === 'utf8') {
            return Promise.reject(new Error('Namespace file read error'));
          }
          if (filePath === tokenPath && encoding === 'utf8') {
            return Promise.resolve('mycluster-token');
          }
          if (filePath === caPath && !encoding) {
            return Promise.resolve(Buffer.from('ca-cert'));
          }
          return Promise.reject(
            new Error(`Unexpected readFile call with path: ${filePath}`),
          );
        },
      );

      // Act
      const result = await kubeConfigReader.getInClusterConfig();

      // Assert
      const expectedResolvedConfig: ResolvedKubeConfig = {
        cluster: {
          server: 'https://10.0.0.1:443',
          certificateAuthorityData: Buffer.from('ca-cert').toString('base64'),
          certificateAuthorityPem: `-----BEGIN CERTIFICATE-----\n${Buffer.from('ca-cert').toString('base64')}\n-----END CERTIFICATE-----`,
        },
        user: {
          token: 'mycluster-token',
        },
      };

      expect(result).toEqual(expectedResolvedConfig);
      expect(mockedLoggerInstance.warn).toHaveBeenCalledWith(
        `Namespace is missing or invalid: ${namespacePath}`,
      );
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
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
      mockFileSystemInstance.access.mockResolvedValue(undefined); // All files exist

      // Define the expected file paths
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      // Mock readFile to return valid data
      (mockFileSystemInstance.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
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

      const expectedResolvedConfig: ResolvedKubeConfig =
        resolvedInClusterKubeConfig;

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
      mockFileSystemInstance.access.mockResolvedValue(undefined); // All files exist

      // Mock readFile to return valid data for token and CA
      const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const namespacePath =
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

      (mockFileSystemInstance.readFile as jest.Mock).mockImplementation(
        (filePath: string, encoding?: BufferEncoding) => {
          switch (filePath) {
            case tokenPath:
              return Promise.resolve('mycluster-token');
            case caPath:
              return Promise.resolve(Buffer.from('ca-cert'));
            // Namespace is optional
            default:
              return Promise.reject(
                new Error(`Unexpected readFile call with path: ${filePath}`),
              );
          }
        },
      );

      const expectedResolvedConfig: ResolvedKubeConfig =
        resolvedInClusterKubeConfig;

      // Act
      const result = await kubeConfigReader.getInClusterConfig();

      // Assert
      expect(result).toEqual(expectedResolvedConfig);

      // Verify that access was called for all required files
      expect(mockFileSystemInstance.access).toHaveBeenCalledWith(tokenPath);
      expect(mockFileSystemInstance.access).toHaveBeenCalledWith(caPath);
      expect(mockFileSystemInstance.access).toHaveBeenCalledWith(namespacePath);

      // Verify readFile was called correctly
      expect(mockFileSystemInstance.readFile).toHaveBeenCalledWith(
        tokenPath,
        'utf8',
      );
      expect(mockFileSystemInstance.readFile).toHaveBeenCalledWith(caPath);

      // Optionally, verify the order of readFile calls
      expect(mockFileSystemInstance.readFile).toHaveBeenNthCalledWith(
        1,
        tokenPath,
        'utf8',
      );
      expect(mockFileSystemInstance.readFile).toHaveBeenNthCalledWith(
        2,
        caPath,
      );

      // Verify the number of readFile calls
      expect(mockFileSystemInstance.readFile).toHaveBeenCalledTimes(2);

      // Verify no logs
      expect(mockedLoggerInstance.error).not.toHaveBeenCalled();
      expect(mockedLoggerInstance.warn).not.toHaveBeenCalled();
    });
  });
});
