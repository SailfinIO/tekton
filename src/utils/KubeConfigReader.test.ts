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

    it('should throw ConfigFileNotFoundError if file does not exist', async () => {
      mockFileSystem.readFile.mockRejectedValue({ code: 'ENOENT' });

      const kubeConfigReader = new KubeConfigReader();

      await expect(kubeConfigReader.getKubeConfig()).rejects.toThrow(
        ConfigFileNotFoundError,
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
