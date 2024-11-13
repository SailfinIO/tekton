import { KubeConfigReader } from './KubeConfigReader';
import { FileSystem } from './FileSystem';
import { YamlParser } from './YamlParser';
import { Logger } from './Logger';
import { PemUtils } from './PemUtils';
import { join } from 'path';
import { spawn } from 'child_process';
import { PemType } from '../enums';
import {
  // src/utils/KubeConfigReader.test.ts

  ConfigFileNotFoundError,
  ExecAuthError,
  InvalidConfigError,
  KubeConfigError,
  NotInClusterError,
  ParsingError,
  PemConversionError,
  PemFormatError,
} from '../errors';
import { KubeConfig } from '../models';

jest.mock('./FileSystem');
jest.mock('./YamlParser');
jest.mock('./Logger');
jest.mock('./PemUtils');
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

describe('KubeConfigReader', () => {
  const mockFileSystem = new FileSystem() as jest.Mocked<FileSystem>;
  const mockYamlParser = new YamlParser() as jest.Mocked<YamlParser>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getKubeConfig', () => {
    it('should return resolved kube config', async () => {
      const mockConfig = {
        currentContext: 'test-context',
        contexts: [
          {
            name: 'test-context',
            context: { cluster: 'test-cluster', user: 'test-user' },
          },
        ],
        clusters: [
          {
            name: 'test-cluster',
            cluster: {
              server: 'https://test-server',
              certificateAuthorityData:
                Buffer.from('test-ca-data').toString('base64'),
            },
          },
        ],
        users: [{ name: 'test-user', user: { token: 'test-token' } }],
      };

      (mockFileSystem.readFile as jest.Mock).mockResolvedValue(
        'mock-file-content',
      );
      mockYamlParser.parse.mockReturnValue(mockConfig);

      const kubeConfigReader = new KubeConfigReader();
      const resolvedConfig = await kubeConfigReader.getKubeConfig();

      expect(resolvedConfig).toEqual({
        cluster: {
          server: 'https://test-server',
          certificateAuthorityData:
            Buffer.from('test-ca-data').toString('base64'),
          certificateAuthorityPem:
            '-----BEGIN CERTIFICATE-----\n' +
            Buffer.from('test-ca-data').toString('base64') +
            '\n-----END CERTIFICATE-----',
        },
        user: {
          token: 'test-token',
          clientCertificateData: undefined,
          clientKeyData: undefined,
          clientCertificatePem: undefined,
          clientKeyPem: undefined,
        },
      });
    });

    it('should throw InvalidConfigError if config is invalid', async () => {
      (mockFileSystem.readFile as jest.Mock).mockResolvedValue(
        'mock-file-content',
      );
      mockYamlParser.parse.mockReturnValue(null);

      const kubeConfigReader = new KubeConfigReader();

      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        InvalidConfigError,
      );
    });
  });

  describe('convertBase64ToPem', () => {
    it('should convert base64 to PEM', () => {
      const kubeConfigReader = new KubeConfigReader();
      const pemString =
        '-----BEGIN CERTIFICATE-----\r\ntest-data\r\n-----END CERTIFICATE-----';
      const base64Data = Buffer.from(pemString, 'utf-8').toString('base64');

      (PemUtils.isValidPem as jest.Mock).mockReturnValue(true);

      const result = kubeConfigReader['convertBase64ToPem'](
        base64Data,
        PemType.CERTIFICATE,
      );

      expect(result).toBe(pemString);
    });

    it('should throw PemFormatError if conversion fails', () => {
      const kubeConfigReader = new KubeConfigReader();
      const base64Data = Buffer.from('test-data').toString('base64');

      (PemUtils.isValidPem as jest.Mock).mockReturnValue(false);
      (PemUtils.bufferToPem as jest.Mock).mockReturnValue('invalid-pem');

      expect(() =>
        kubeConfigReader['convertBase64ToPem'](base64Data, PemType.CERTIFICATE),
      ).toThrow(PemFormatError);
    });
  });

  describe('getInClusterConfig', () => {
    it('should return in-cluster config', async () => {
      process.env.KUBERNETES_SERVICE_HOST = 'test-host';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      const token = 'test-token';
      const caBuffer = Buffer.from('test-ca');
      const caPem =
        '-----BEGIN CERTIFICATE-----\ntest-ca\n-----END CERTIFICATE-----';

      // Mock the readFile method for token and CA
      (mockFileSystem.readFile as jest.Mock)
        .mockResolvedValueOnce(token) // For token
        .mockResolvedValueOnce(caBuffer); // For CA

      // Mock PemUtils methods
      (PemUtils.bufferToPem as jest.Mock).mockReturnValue(caPem);
      (PemUtils.isValidPem as jest.Mock).mockReturnValue(true);

      const kubeConfigReader = new KubeConfigReader();
      const resolvedConfig = await kubeConfigReader.getInClusterConfig();

      expect(resolvedConfig).toEqual({
        cluster: {
          name: 'in-cluster',
          server: 'https://test-host:443',
          certificateAuthorityData: caBuffer.toString('base64'),
          certificateAuthorityPem: caPem,
        },
        user: {
          token: token.trim(),
        },
      });

      // Additionally, ensure that PemUtils methods were called correctly
      expect(PemUtils.bufferToPem).toHaveBeenCalledWith(
        caBuffer,
        PemType.CERTIFICATE,
      );
      expect(PemUtils.isValidPem).toHaveBeenCalledWith(
        caPem,
        PemType.CERTIFICATE,
      );
    });

    it('should throw NotInClusterError if not in cluster', async () => {
      delete process.env.KUBERNETES_SERVICE_HOST;
      delete process.env.KUBERNETES_SERVICE_PORT;

      const kubeConfigReader = new KubeConfigReader();

      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        NotInClusterError,
      );
    });
  });

  describe('KubeConfigReader with exec authentication', () => {
    it('should handle exec-based authentication and return resolved kube config', async () => {
      const mockConfig = {
        currentContext: 'exec-context',
        contexts: [
          {
            name: 'exec-context',
            context: { cluster: 'exec-cluster', user: 'exec-user' },
          },
        ],
        clusters: [
          {
            name: 'exec-cluster',
            cluster: {
              server: 'https://exec-server',
              certificateAuthorityData:
                Buffer.from('exec-ca-data').toString('base64'),
            },
          },
        ],
        users: [
          {
            name: 'exec-user',
            user: {
              exec: {
                command: 'exec-command',
                args: ['--arg1'],
                env: { VAR: 'value' },
              },
            },
          },
        ],
      };

      (mockFileSystem.readFile as jest.Mock).mockResolvedValue(
        'mock-file-content',
      );
      mockYamlParser.parse.mockReturnValue(mockConfig);

      const mockToken = 'exec-token';

      const kubeConfigReader = new KubeConfigReader();
      kubeConfigReader['getExecToken'] = jest.fn().mockResolvedValue(mockToken);

      // Configure isValidPem to return false first and true after conversion
      (PemUtils.isValidPem as jest.Mock)
        .mockImplementationOnce(() => false) // Initial check
        .mockImplementationOnce(() => true); // After conversion

      (PemUtils.bufferToPem as jest.Mock).mockReturnValue(
        '-----BEGIN CERTIFICATE-----\nexec-ca-data\n-----END CERTIFICATE-----',
      );

      const resolvedConfig = await kubeConfigReader.getKubeConfig();

      expect(kubeConfigReader['getExecToken']).toHaveBeenCalledWith(
        mockConfig.users[0].user.exec,
      );
      expect(resolvedConfig).toEqual({
        cluster: {
          server: 'https://exec-server',
          certificateAuthorityData:
            Buffer.from('exec-ca-data').toString('base64'),
          certificateAuthorityPem:
            '-----BEGIN CERTIFICATE-----\nexec-ca-data\n-----END CERTIFICATE-----',
        },
        user: {
          token: 'exec-token',
          clientCertificateData: undefined,
          clientKeyData: undefined,
          clientCertificatePem: undefined,
          clientKeyPem: undefined,
        },
      });
    });
  });

  describe('KubeConfigReader with client certificate authentication', () => {
    it('should handle client-certificate-based authentication and return resolved kube config', async () => {
      const mockConfig = {
        currentContext: 'cert-context',
        contexts: [
          {
            name: 'cert-context',
            context: { cluster: 'cert-cluster', user: 'cert-user' },
          },
        ],
        clusters: [
          {
            name: 'cert-cluster',
            cluster: {
              server: 'https://cert-server',
              certificateAuthorityData:
                Buffer.from('cert-ca-data').toString('base64'), // Y2VydC1jYS1kYXRh
            },
          },
        ],
        users: [
          {
            name: 'cert-user',
            user: {
              clientCertificateData:
                Buffer.from('cert-client-data').toString('base64'), // Y2VydC1jbGllbnQtZGF0YQ==
              clientKeyData: Buffer.from('cert-key-data').toString('base64'), // Y2VydC1rZXktZGF0YQ==
            },
          },
        ],
      };

      (mockFileSystem.readFile as jest.Mock).mockResolvedValue(
        'mock-file-content',
      );
      mockYamlParser.parse.mockReturnValue(mockConfig);

      // Configure isValidPem for certificate and key
      (PemUtils.isValidPem as jest.Mock)
        .mockImplementationOnce(() => false) // cert CA initial
        .mockImplementationOnce(() => true) // cert CA after conversion
        .mockImplementationOnce(() => false) // client cert initial
        .mockImplementationOnce(() => true) // client cert after conversion
        .mockImplementationOnce(() => false) // client key initial
        .mockImplementationOnce(() => true); // client key after conversion

      // Corrected bufferToPem mock
      (PemUtils.bufferToPem as jest.Mock).mockImplementation(
        (buffer: Buffer, type: PemType) => {
          if (type === PemType.CERTIFICATE) {
            return `-----BEGIN CERTIFICATE-----\n${buffer.toString('utf-8')}\n-----END CERTIFICATE-----`;
          } else if (type === PemType.PRIVATE_KEY) {
            return `-----BEGIN PRIVATE KEY-----\n${buffer.toString('utf-8')}\n-----END PRIVATE KEY-----`;
          }
          return buffer.toString('utf-8');
        },
      );

      const kubeConfigReader = new KubeConfigReader();
      const resolvedConfig = await kubeConfigReader.getKubeConfig();

      expect(resolvedConfig).toEqual({
        cluster: {
          server: 'https://cert-server',
          certificateAuthorityData:
            Buffer.from('cert-ca-data').toString('base64'), // "Y2VydC1jYS1kYXRh"
          certificateAuthorityPem:
            '-----BEGIN CERTIFICATE-----\ncert-ca-data\n-----END CERTIFICATE-----',
        },
        user: {
          token: undefined,
          clientCertificateData:
            Buffer.from('cert-client-data').toString('base64'), // "Y2VydC1jbGllbnQtZGF0YQ=="
          clientKeyData: Buffer.from('cert-key-data').toString('base64'), // "Y2VydC1rZXktZGF0YQ=="
          clientCertificatePem:
            '-----BEGIN CERTIFICATE-----\ncert-client-data\n-----END CERTIFICATE-----',
          clientKeyPem:
            '-----BEGIN PRIVATE KEY-----\ncert-key-data\n-----END PRIVATE KEY-----',
        },
      });

      // Ensure convertBase64ToPem was called for both cert and key
      expect(PemUtils.isValidPem).toHaveBeenCalledWith(
        'cert-ca-data',
        PemType.CERTIFICATE,
      );
      expect(PemUtils.isValidPem).toHaveBeenCalledWith(
        'cert-client-data',
        PemType.CERTIFICATE,
      );
      expect(PemUtils.isValidPem).toHaveBeenCalledWith(
        'cert-key-data',
        PemType.PRIVATE_KEY,
      );
    });
  });

  describe('mapKeys', () => {
    it('should convert all keys from kebab-case to camelCase recursively', () => {
      const kubeConfigReader = new KubeConfigReader();
      const input = {
        'current-context': 'test-context',
        'certificate-authority-data': 'data',
        contexts: [
          {
            'cluster-name': 'test-cluster',
            context: {
              'user-name': 'test-user',
            },
          },
        ],
      };

      const expectedOutput = {
        currentContext: 'test-context',
        certificateAuthorityData: 'data',
        contexts: [
          {
            clusterName: 'test-cluster',
            context: {
              userName: 'test-user',
            },
          },
        ],
      };

      const result = kubeConfigReader['mapKeys'](input);
      expect(result).toEqual(expectedOutput);
    });
  });

  describe('getConfigSection', () => {
    let kubeConfigReader: KubeConfigReader;

    beforeEach(() => {
      kubeConfigReader = new KubeConfigReader();
    });

    it('should retrieve the specified cluster section successfully', () => {
      const config: KubeConfig = {
        clusters: [
          {
            cluster: {
              name: 'docker-desktop',
              server: 'https://127.0.0.1:6443',
              certificateAuthorityData: 'data here',
            },
          },
          {
            cluster: {
              name: 'gke_kinetic-physics-419020_us-east1_sailfin-demo',
              server: 'https://34.138.163.226',
              certificateAuthorityData: 'data here',
            },
          },
        ],
      };

      const result = kubeConfigReader['getConfigSection'](
        config.clusters,
        'docker-desktop',
        'clusters',
      );
      expect(result).toEqual({
        cluster: {
          name: 'docker-desktop',
          server: 'https://127.0.0.1:6443',
          certificateAuthorityData: 'data here',
        },
      });
    });

    it('should retrieve the specified user section successfully', () => {
      const config: KubeConfig = {
        users: [
          {
            name: 'docker-desktop',
            user: {
              clientCertificateData: 'data here',
              clientKeyData: 'data here',
            },
          },
          {
            name: 'gke_kinetic-physics-419020_us-east1_sailfin-demo',
            user: {
              exec: {
                apiVersion: 'client.authentication.k8s.io/v1beta1',
                command: 'gke-gcloud-auth-plugin',
                args: null,
                env: null,
              },
            },
          },
        ],
      };

      const result = kubeConfigReader['getConfigSection'](
        config.users,
        'docker-desktop',
        'users',
      );
      expect(result).toEqual({
        name: 'docker-desktop',
        user: {
          clientCertificateData: 'data here',
          clientKeyData: 'data here',
        },
      });
    });

    it('should throw ConfigFileNotFoundError if the specified cluster section is not found', () => {
      const config: KubeConfig = {
        clusters: [
          {
            cluster: {
              name: 'docker-desktop',
              server: 'https://127.0.0.1:6443',
            },
          },
        ],
      };

      expect(() =>
        kubeConfigReader['getConfigSection'](
          config.clusters,
          'nonexistent-cluster',
          'clusters',
        ),
      ).toThrow(ConfigFileNotFoundError);
    });

    it('should throw ConfigFileNotFoundError if the user section array is undefined', () => {
      expect(() =>
        kubeConfigReader['getConfigSection'](
          undefined,
          'docker-desktop',
          'users',
        ),
      ).toThrow(ConfigFileNotFoundError);
    });
  });

  describe('validateData', () => {
    it('should pass validation for valid base64 data', () => {
      const kubeConfigReader = new KubeConfigReader();
      expect(() =>
        kubeConfigReader['validateData']('dGVzdA==', 'testField'),
      ).not.toThrow();
    });

    it('should throw InvalidConfigError for invalid base64 data', () => {
      const kubeConfigReader = new KubeConfigReader();
      expect(() =>
        kubeConfigReader['validateData']('invalid-base64', 'testField'),
      ).toThrow(InvalidConfigError);
    });

    it('should pass validation when data is undefined', () => {
      const kubeConfigReader = new KubeConfigReader();
      expect(() =>
        kubeConfigReader['validateData'](undefined, 'testField'),
      ).not.toThrow();
    });
  });

  describe('handleError', () => {
    it('should rethrow known KubeConfigError instances and log the error', async () => {
      const kubeConfigReader = new KubeConfigReader();
      const error = new ConfigFileNotFoundError('Config file missing');

      // Spy on logger.error instead of logError
      const loggerErrorSpy = jest.spyOn(kubeConfigReader['logger'], 'error');

      await expect(kubeConfigReader['handleError'](error)).rejects.toThrow(
        error,
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(error.message, error);
    });

    it('should handle ENOENT error by throwing ConfigFileNotFoundError and log the error', async () => {
      const kubeConfigReader = new KubeConfigReader();
      const enoentError = { code: 'ENOENT', message: 'File not found' };

      // Spy on logger.error
      const loggerErrorSpy = jest.spyOn(kubeConfigReader['logger'], 'error');

      await expect(
        kubeConfigReader['handleError'](enoentError),
      ).rejects.toThrow(ConfigFileNotFoundError);

      // Expect logger.error to be called with the new ConfigFileNotFoundError
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Kubeconfig file not found at path: ${kubeConfigReader['kubeConfigPath']}`,
        expect.any(ConfigFileNotFoundError),
      );
    });

    it('should handle unexpected errors by throwing KubeConfigError and log the error', async () => {
      const kubeConfigReader = new KubeConfigReader();
      const unexpectedError = new Error('Unexpected failure');

      // Spy on logger.error instead of logError
      const loggerErrorSpy = jest.spyOn(kubeConfigReader['logger'], 'error');

      await expect(
        kubeConfigReader['handleError'](unexpectedError),
      ).rejects.toThrow(KubeConfigError);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Unexpected error: ${unexpectedError.message}`,
        unexpectedError,
      );
    });
  });

  describe('validateInClusterFiles', () => {
    it('should pass when all required in-cluster files exist', async () => {
      const kubeConfigReader = new KubeConfigReader();
      const paths = {
        token: '/path/to/token',
        ca: '/path/to/ca.crt',
        namespace: '/path/to/namespace',
      };

      // Mock fileExists to return true for token and ca, false for namespace (which is optional)
      kubeConfigReader['fileExists'] = jest
        .fn()
        .mockImplementation((filePath: string) => {
          if (filePath === paths.token || filePath === paths.ca) {
            return Promise.resolve(true);
          }
          return Promise.resolve(false);
        });

      // Spy on logger.warn for missing namespace
      const loggerWarnSpy = jest.spyOn(kubeConfigReader['logger'], 'warn');

      await expect(
        kubeConfigReader['validateInClusterFiles'](paths),
      ).resolves.toBeUndefined();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        `Namespace is missing or invalid: ${paths.namespace}`,
      );
    });

    it('should throw ConfigFileNotFoundError when required files are missing', async () => {
      const kubeConfigReader = new KubeConfigReader();
      const paths = {
        token: '/path/to/token',
        ca: '/path/to/ca.crt',
        namespace: '/path/to/namespace',
      };

      // Mock fileExists to return false for token and true for ca
      kubeConfigReader['fileExists'] = jest
        .fn()
        .mockImplementation((filePath: string) => {
          if (filePath === paths.token) {
            return Promise.resolve(false);
          }
          return Promise.resolve(true);
        });

      // Spy on logger.error
      const loggerErrorSpy = jest.spyOn(kubeConfigReader['logger'], 'error');

      await expect(
        kubeConfigReader['validateInClusterFiles'](paths),
      ).rejects.toThrow(ConfigFileNotFoundError);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Missing service account token file at ${paths.token}`,
      );
    });
  });

  describe('readInClusterFiles', () => {
    it('should read token and CA files successfully', async () => {
      const kubeConfigReader = new KubeConfigReader();
      const paths = {
        token: '/path/to/token',
        ca: '/path/to/ca.crt',
      };

      const mockToken = 'service-account-token';
      const mockCaBuffer = Buffer.from('ca-cert');

      // Mock readFile to return token and CA buffer
      (kubeConfigReader['fileSystem'].readFile as jest.Mock)
        .mockResolvedValueOnce(mockToken)
        .mockResolvedValueOnce(mockCaBuffer);

      const result = await kubeConfigReader['readInClusterFiles'](paths);
      expect(result).toEqual([mockToken, mockCaBuffer]);
    });

    it('should throw ConfigFileNotFoundError if reading files fails', async () => {
      const kubeConfigReader = new KubeConfigReader();
      const paths = {
        token: '/path/to/token',
        ca: '/path/to/ca.crt',
      };

      // Mock readFile to reject
      (kubeConfigReader['fileSystem'].readFile as jest.Mock).mockRejectedValue(
        new Error('Read failure'),
      );

      await expect(
        kubeConfigReader['readInClusterFiles'](paths),
      ).rejects.toThrow(ConfigFileNotFoundError);
    });
  });

  describe('validateInClusterData', () => {
    it('should pass validation for valid token and CA buffer', () => {
      const kubeConfigReader = new KubeConfigReader();
      const token = ' valid-token ';
      const caBuffer = Buffer.from('valid-ca');

      expect(() =>
        kubeConfigReader['validateInClusterData'](token, caBuffer),
      ).not.toThrow();
    });

    it('should throw InvalidConfigError for invalid token', () => {
      const kubeConfigReader = new KubeConfigReader();
      const token = '   ';
      const caBuffer = Buffer.from('valid-ca');

      expect(() =>
        kubeConfigReader['validateInClusterData'](token, caBuffer),
      ).toThrow(InvalidConfigError);
    });

    it('should throw InvalidConfigError for invalid CA buffer', () => {
      const kubeConfigReader = new KubeConfigReader();
      const token = 'valid-token';
      const caBuffer = Buffer.alloc(0); // Empty buffer

      expect(() =>
        kubeConfigReader['validateInClusterData'](token, caBuffer),
      ).toThrow(InvalidConfigError);
    });
  });

  describe('constructServerUrl', () => {
    it('should construct the correct server URL from environment variables', () => {
      const kubeConfigReader = new KubeConfigReader();
      process.env.KUBERNETES_SERVICE_HOST = '192.168.1.1';
      process.env.KUBERNETES_SERVICE_PORT = '8443';

      const serverUrl = kubeConfigReader['constructServerUrl']();
      expect(serverUrl).toBe('https://192.168.1.1:8443');
    });

    it('should throw ConfigFileNotFoundError when environment variables are missing', () => {
      const kubeConfigReader = new KubeConfigReader();
      delete process.env.KUBERNETES_SERVICE_HOST;
      delete process.env.KUBERNETES_SERVICE_PORT;

      // Spy on logger.error
      const loggerErrorSpy = jest.spyOn(kubeConfigReader['logger'], 'error');

      expect(() => kubeConfigReader['constructServerUrl']()).toThrow(
        ConfigFileNotFoundError,
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Missing Kubernetes service environment variables.',
        { serviceHost: undefined, servicePort: undefined },
      );
    });
  });

  describe('fileExists', () => {
    it('should return true if the file exists', async () => {
      const kubeConfigReader = new KubeConfigReader();
      (kubeConfigReader['fileSystem'].access as jest.Mock).mockResolvedValue(
        undefined,
      );

      const exists = await kubeConfigReader['fileExists']('/path/to/exist');
      expect(exists).toBe(true);
    });

    it('should return false if the file does not exist', async () => {
      const kubeConfigReader = new KubeConfigReader();
      (kubeConfigReader['fileSystem'].access as jest.Mock).mockRejectedValue(
        new Error('Not found'),
      );

      const exists = await kubeConfigReader['fileExists']('/path/to/missing');
      expect(exists).toBe(false);
    });
  });

  describe('convertBase64ToPem with DER input', () => {
    it('should convert DER-encoded base64 data to PEM', () => {
      const kubeConfigReader = new KubeConfigReader();
      const derData = Buffer.from('der-data');
      const base64Data = derData.toString('base64');
      const pemData =
        '-----BEGIN CERTIFICATE-----\nder-data-base64\n-----END CERTIFICATE-----';

      // Mock PemUtils.isValidPem to return false initially and true after conversion
      (PemUtils.isValidPem as jest.Mock)
        .mockReturnValueOnce(false) // Original decoded data is not PEM
        .mockReturnValueOnce(true); // Converted PEM is valid
      (PemUtils.bufferToPem as jest.Mock).mockReturnValue(pemData);

      const result = kubeConfigReader['convertBase64ToPem'](
        base64Data,
        PemType.CERTIFICATE,
      );

      expect(result).toBe(pemData);
      expect(PemUtils.bufferToPem).toHaveBeenCalledWith(
        derData,
        PemType.CERTIFICATE,
      );
      expect(PemUtils.isValidPem).toHaveBeenCalledWith(
        pemData,
        PemType.CERTIFICATE,
      );
    });
  });

  describe('getInClusterConfig with invalid PEM', () => {
    it('should throw PemFormatError if the converted PEM is invalid', async () => {
      process.env.KUBERNETES_SERVICE_HOST = 'test-host';
      process.env.KUBERNETES_SERVICE_PORT = '443';

      const token = 'test-token';
      const caBuffer = Buffer.from('invalid-ca');
      const invalidPem = 'invalid-pem';

      // Mock readFile for token and CA
      (mockFileSystem.readFile as jest.Mock)
        .mockResolvedValueOnce(token) // token
        .mockResolvedValueOnce(caBuffer); // CA

      // Mock PemUtils methods
      (PemUtils.bufferToPem as jest.Mock).mockReturnValue(invalidPem);
      (PemUtils.isValidPem as jest.Mock).mockReturnValue(false);

      const kubeConfigReader = new KubeConfigReader();

      await expect(kubeConfigReader.getInClusterConfig()).rejects.toThrow(
        PemFormatError,
      );
    });
  });

  describe('getExecToken', () => {
    it('should return token from exec command', async () => {
      const execConfig = {
        command: 'test-command',
        args: ['arg1'],
        env: { TEST_ENV: 'test' },
      };
      const token = 'test-token';

      (spawn as jest.Mock).mockReturnValue({
        stdout: { on: jest.fn((event, cb) => cb(JSON.stringify({ token }))) },
        stderr: { on: jest.fn() },
        on: jest.fn((event, cb) => cb(0)),
      });

      const kubeConfigReader = new KubeConfigReader();
      const result = await kubeConfigReader['getExecToken'](execConfig);

      expect(result).toBe(token);
    });

    it('should throw ExecAuthError if exec command fails', async () => {
      const execConfig = {
        command: 'test-command',
        args: ['arg1'],
        env: { TEST_ENV: 'test' },
      };

      (spawn as jest.Mock).mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn((event, cb) => cb('error')) },
        on: jest.fn((event, cb) => cb(1)),
      });

      const kubeConfigReader = new KubeConfigReader();

      await expect(
        kubeConfigReader['getExecToken'](execConfig),
      ).rejects.toThrow(ExecAuthError);
    });
  });
});
