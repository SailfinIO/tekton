// src/clients/KubernetesClient.test.ts
// Import mocks

jest.mock('../utils/KubeConfigReader');
jest.mock('../utils/Logger');
jest.mock('../utils/FileSystem');
jest.mock('../utils/YamlParser');
jest.mock('../utils/PemUtils');

import { Logger } from '../utils/Logger';
import { KubeConfigReader } from '../utils/KubeConfigReader';

import nock from 'nock';
import { KubernetesClient } from './KubernetesClient';
import { KubernetesResource, WatchEvent } from '../models';
import { HttpStatus, LogLevel, PemType } from '../enums';
import {
  ApiError,
  ClientError,
  KubeConfigError,
  NetworkError,
  ParsingError,
  PemFormatError,
} from '../errors';
import {
  resolvedInClusterKubeConfig,
  resolvedValidKubeConfig,
} from '../utils/__mocks__/kubeConfigMocks';
import { IFileSystem } from '../interfaces';
import { PemUtils } from '../utils/PemUtils';
import { createMockFileSystem } from '../utils/__mocks__/FileSystem';
import { KindToResourceNameMap } from '../constants';
import { PassThrough } from 'stream';

describe('KubernetesClient', () => {
  let kubernetesClient: KubernetesClient;
  let mockFileSystem: jest.Mocked<IFileSystem>;
  let mockedLogger: jest.Mocked<Logger>;

  const mockKubeConfigPath = '/mock/.kube/config';

  beforeEach(async () => {
    jest.resetAllMocks();

    // Mock KubeConfigReader methods
    (
      KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
    ).prototype.getKubeConfig = jest
      .fn()
      .mockResolvedValue(resolvedValidKubeConfig);
    (
      KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
    ).prototype.getInClusterConfig = jest
      .fn()
      .mockResolvedValue(resolvedInClusterKubeConfig);

    // Mock PemUtils methods
    const mockedPemUtils = PemUtils as jest.Mocked<typeof PemUtils>;

    mockedPemUtils.isValidPem.mockImplementation(
      (pem: string, type: PemType) => {
        const pemRegex = new RegExp(
          `-----BEGIN ${type}-----[\\s\\S]+-----END ${type}-----`,
          'i',
        );
        return pemRegex.test(pem);
      },
    );

    mockedPemUtils.bufferToPem.mockImplementation(
      (buffer: Buffer, type: PemType) => {
        const base64Data = buffer.toString('base64');
        return `-----BEGIN ${type}-----\n${base64Data}\n-----END ${type}-----`;
      },
    );

    mockedPemUtils.pemToBuffer.mockImplementation(
      (pem: string, type: PemType) => {
        const base64Data = pem
          .replace(`-----BEGIN ${type}-----`, '')
          .replace(`-----END ${type}-----`, '')
          .replace(/\n/g, '');
        if (!PemUtils.isValidPem(pem, type)) {
          throw new PemFormatError(`Invalid PEM format for type: ${type}`);
        }
        return Buffer.from(base64Data, 'base64');
      },
    );

    // Instantiate mocked Logger
    const logger = new Logger('Test Logger', LogLevel.DEBUG, false);
    mockedLogger = logger as jest.Mocked<Logger>;

    // Create and configure the mock FileSystem
    mockFileSystem = createMockFileSystem();

    (mockFileSystem.readFile as jest.Mock).mockImplementation(
      async (path: string, encoding?: string): Promise<string | Buffer> => {
        if (encoding) {
          if (encoding !== 'utf8') {
            throw new Error('Unsupported encoding');
          }
          switch (path) {
            case 'client-cert.pem':
              return `-----BEGIN CERTIFICATE-----
  MIIC+DCCAeCgAwIBAgIJAK3vFakeExampleCertDataMIIC+DCCAeCgAwIBAgIJAK3v
  -----END CERTIFICATE-----`;
            case 'client-key.pem':
              return `-----BEGIN PRIVATE KEY-----
  MIIEvQIBADANBgkqhkiG9w0BAQEFAASCExampleKeyDataMIIEvQIBADANBgkqhkiG9w0BA
  -----END PRIVATE KEY-----`;
            case 'ca-cert.pem':
              return `-----BEGIN CERTIFICATE-----
  MIIDdzCCAl+gAwIBAgIEbFnFakeExampleCACertDataMIIDdzCCAl+gAwIBAgIEbFn
  -----END CERTIFICATE-----`;
            default:
              throw new Error(`Unknown file path: ${path}`);
          }
        } else {
          // Handle calls without encoding, returning Buffer
          switch (path) {
            case 'ca-cert.pem':
              return Buffer.from(
                '-----BEGIN CERTIFICATE-----\nMIIDdzCCAl+gAwIBAgIEbFnFakeExampleCACertDataMIIDdzCCAl+gAwIBAgIEbFn\n-----END CERTIFICATE-----',
              );
            case 'client-cert.pem':
              return Buffer.from(
                '-----BEGIN CERTIFICATE-----\nMIIC+DCCAeCgAwIBAgIJAK3vFakeExampleCertDataMIIC+DCCAeCgAwIBAgIJAK3v\n-----END CERTIFICATE-----',
              );
            case 'client-key.pem':
              return Buffer.from(
                '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCExampleKeyDataMIIEvQIBADANBgkqhkiG9w0BA\n-----END PRIVATE KEY-----',
              );
            default:
              throw new Error(`Unknown file path: ${path}`);
          }
        }
      },
    );

    // Create the KubernetesClient instance with mocked dependencies
    kubernetesClient = await KubernetesClient.create({
      kubeConfigPath: mockKubeConfigPath,
      logLevel: LogLevel.INFO,
      fileSystem: mockFileSystem,
      logger: mockedLogger,
    });
  });

  /**
   * Test Suite for Static create Method
   */
  describe('create', () => {
    it('should successfully create a KubernetesClient instance with provided kubeConfigPath', async () => {
      // Arrange is already done in beforeEach

      // Act & Assert
      expect(kubernetesClient).toBeInstanceOf(KubernetesClient);
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Loading kube config from file.',
      );
      expect(mockedLogger.info).toHaveBeenCalledWith(
        `Loaded kube config from ${mockKubeConfigPath}.`,
      );
      expect(mockedLogger.debug).toHaveBeenCalledWith(
        'KubernetesClient initialized.',
      );
    });

    it('should fallback to in-cluster config if loading from file fails with KubeConfigError', async () => {
      // Arrange
      // Mock the getKubeConfig to throw KubeConfigError
      (
        KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
      ).prototype.getKubeConfig.mockRejectedValue(
        new KubeConfigError('Failed to load kubeconfig from file.'),
      );

      // Mock in-cluster config resolution
      (
        KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
      ).prototype.getInClusterConfig.mockResolvedValue(
        resolvedInClusterKubeConfig,
      );

      // Act
      const client = await KubernetesClient.create({
        kubeConfigPath: mockKubeConfigPath,
        fileSystem: mockFileSystem,
        logger: mockedLogger,
      });

      // Assert
      expect(client).toBeInstanceOf(KubernetesClient);
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Loading kube config from file.',
      );
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Failed to load kubeconfig from file. Attempting to load in-cluster config.',
      );
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Loaded in-cluster kube config.',
      );
    });

    it('should throw ClientError if both file and in-cluster config loading fail', async () => {
      // Arrange
      (
        KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
      ).prototype.getKubeConfig.mockRejectedValue(
        new KubeConfigError('Failed to load kubeconfig from file.'),
      );

      (
        KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
      ).prototype.getInClusterConfig.mockRejectedValue(
        new KubeConfigError('Failed to load in-cluster kube config.'),
      );

      // Act & Assert
      await expect(
        KubernetesClient.create({
          kubeConfigPath: mockKubeConfigPath,
          fileSystem: mockFileSystem,
          logger: mockedLogger,
        }),
      ).rejects.toThrow(ClientError);

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Failed to load kubeconfig from file. Attempting to load in-cluster config.',
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to load in-cluster kube config.',
        expect.any(KubeConfigError),
      );
    });

    it('should throw unexpected errors when loading kubeconfig', async () => {
      // Arrange
      const unexpectedError = new Error('Unexpected error occurred');

      (
        KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
      ).prototype.getKubeConfig.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(
        KubernetesClient.create({
          kubeConfigPath: mockKubeConfigPath,
          fileSystem: mockFileSystem,
          logger: mockedLogger,
        }),
      ).rejects.toThrow('Unexpected error');

      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Unexpected error while loading kube config.',
        unexpectedError,
      );
    });
    describe('mapKeys', () => {
      it('should correctly map keys from kebab-case to camelCase', () => {
        const { KubeConfigReader } = jest.requireActual(
          '../utils/KubeConfigReader',
        );
        const reader = new KubeConfigReader();
        const input = {
          'current-context': 'docker-desktop',
          contexts: [
            {
              name: 'docker-desktop',
              context: {
                cluster: 'docker-desktop',
                user: 'docker-desktop',
              },
            },
          ],
          clusters: [
            {
              name: 'docker-desktop',
              cluster: {
                'certificate-authority-data': 'some-data',
                server: 'https://kubernetes.docker.internal:6443',
              },
            },
          ],
          users: [
            {
              name: 'docker-desktop',
              user: {
                'client-certificate-data': 'some-data',
                'client-key-data': 'some-data',
              },
            },
          ],
        };

        const expectedOutput = {
          currentContext: 'docker-desktop',
          contexts: [
            {
              name: 'docker-desktop',
              context: {
                cluster: 'docker-desktop',
                user: 'docker-desktop',
              },
            },
          ],
          clusters: [
            {
              name: 'docker-desktop',
              cluster: {
                certificateAuthorityData: 'some-data',
                server: 'https://kubernetes.docker.internal:6443',
              },
            },
          ],
          users: [
            {
              name: 'docker-desktop',
              user: {
                clientCertificateData: 'some-data',
                clientKeyData: 'some-data',
              },
            },
          ],
        };

        // Access the private mapKeys method
        const result = (reader as any).mapKeys(input);
        expect(result).toEqual(expectedOutput);
      });
    });
  });

  /**
   * Test Suite for getResource Method
   */
  describe('getResource', () => {
    const apiVersion = 'v1';
    const kind = 'Pod';
    const name = 'test-pod';
    const namespace = 'default';
    const resourcePath = '/api/v1/namespaces/default/pods/test-pod';
    const mockResource: KubernetesResource = {
      apiVersion,
      kind,
      metadata: { name, namespace },
    };

    it('should fetch a specific resource successfully', async () => {
      // Arrange
      const apiVersion = 'v1';
      const kind = 'Pod';
      const name = 'test-pod';
      const namespace = 'default';
      const resourcePath = `/api/${apiVersion}/namespaces/${namespace}/pods/${name}`;
      const mockResource = {
        apiVersion,
        kind,
        metadata: { name, namespace },
      };

      const scope = nock('https://127.0.0.1:6443')
        .get(resourcePath) // Intercepts the GET request to the specific path
        .reply(HttpStatus.OK, mockResource);

      // Act
      const result = await kubernetesClient.getResource<KubernetesResource>(
        apiVersion,
        kind,
        name,
        namespace,
      );

      // Assert
      expect(result).toEqual(mockResource);
      expect(mockedLogger.debug).toHaveBeenCalledWith(
        `Fetching resource of kind: ${kind}, name: ${name}, namespace: ${namespace}`,
      );
      expect(mockedLogger.info).toHaveBeenCalledWith(
        `[getResource] Fetching resource: Pod with name: test-pod in namespace: default`,
      );
      expect(mockedLogger.info).toHaveBeenCalledWith(
        `[getResource] Success: Fetching resource: Pod with name: test-pod in namespace: default`,
      );

      // Verify that the request was made as expected
      expect(scope.isDone()).toBe(true); // Checks that all nock interceptors were satisfied
    });

    it('should throw ApiError when the API responds with non-2xx status code', async () => {
      // Arrange
      const errorMessage = 'Not Found';
      nock('https://127.0.0.1:6443')
        .get('/api/v1/namespaces/default/pods/test-pod')
        .reply(HttpStatus.NOT_FOUND, errorMessage);

      // Act & Assert
      await expect(
        kubernetesClient.getResource<KubernetesResource>(
          apiVersion,
          kind,
          name,
          namespace,
        ),
      ).rejects.toThrow(ApiError);

      expect(mockedLogger.error).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining(
          `[getResource] Failed to fetch resource Pod with name test-pod: Request failed with status code ${HttpStatus.NOT_FOUND}`,
        ),
        expect.objectContaining({
          responseBody: errorMessage,
        }),
      );
    });

    it('should throw NetworkError on request error', async () => {
      // Arrange
      const networkError = new Error('Network failure');
      nock('https://127.0.0.1:6443')
        .get('/api/v1/namespaces/default/pods/test-pod')
        .replyWithError(networkError.message);

      // Act & Assert
      await expect(
        kubernetesClient.getResource<KubernetesResource>(
          apiVersion,
          kind,
          name,
          namespace,
        ),
      ).rejects.toThrow(NetworkError);

      expect(mockedLogger.error).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining(
          `[getResource] Failed to fetch resource Pod with name test-pod: Network error occurred during the request.`,
        ),
        expect.objectContaining({
          originalError: networkError,
        }),
      );
    });

    it('should throw ParsingError when response JSON is invalid', async () => {
      // Arrange
      const invalidJson = 'Invalid JSON';
      nock('https://127.0.0.1:6443')
        .get('/api/v1/namespaces/default/pods/test-pod')
        .reply(HttpStatus.OK, invalidJson);

      // Act & Assert
      await expect(
        kubernetesClient.getResource<KubernetesResource>(
          apiVersion,
          kind,
          name,
          namespace,
        ),
      ).rejects.toThrow(ParsingError);

      expect(mockedLogger.error).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(
          `Failed to parse response JSON: Unexpected token 'I', "Invalid JSON" is not valid JSON`,
        ),
      );
    });

    /**
     * Test Suite for listResources Method
     */
    describe('listResources', () => {
      const apiVersion = 'v1';
      const kind = 'Pod';
      const namespace = 'default';
      const resourcePath = '/api/v1/namespaces/default/pods';
      const mockResources: KubernetesResource[] = [
        { apiVersion, kind, metadata: { name: 'pod1', namespace } },
        { apiVersion, kind, metadata: { name: 'pod2', namespace } },
      ];

      it('should list resources successfully without selectors', async () => {
        // Arrange
        const responseData = { items: mockResources };
        nock('https://127.0.0.1:6443')
          .get('/api/v1/namespaces/default/pods')
          .reply(HttpStatus.OK, responseData);

        // Act
        const result = await kubernetesClient.listResources<KubernetesResource>(
          apiVersion,
          kind,
          namespace,
        );

        // Assert
        expect(result).toEqual(mockResources);
        expect(mockedLogger.debug).toHaveBeenCalledWith(
          `Listing resources of kind: ${kind}, namespace: ${namespace}`,
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          `[listResources] Listing resources of kind: Pod in namespace: default`,
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          `[listResources] Success: Listing resources of kind: Pod in namespace: default`,
        );

        // Verify that the request was made as expected
        expect(nock.isDone()).toBe(true);
      });

      it('should list resources with label and field selectors', async () => {
        // Arrange
        const labelSelector = 'app=frontend';
        const fieldSelector = 'status.phase=Running';
        const expectedPath = `/api/v1/namespaces/default/pods?labelSelector=app%3Dfrontend&fieldSelector=status.phase%3DRunning`;
        const responseData = { items: mockResources };

        nock('https://127.0.0.1:6443')
          .get(expectedPath)
          .reply(HttpStatus.OK, responseData);

        // Act
        const result = await kubernetesClient.listResources<KubernetesResource>(
          apiVersion,
          kind,
          namespace,
          labelSelector,
          fieldSelector,
        );

        // Assert
        expect(result).toEqual(mockResources);

        // Verify that the request was made as expected
        expect(nock.isDone()).toBe(true);
      });

      it('should throw ApiError when listing resources fails', async () => {
        // Arrange
        const errorMessage = 'Unauthorized';
        nock('https://127.0.0.1:6443')
          .get('/api/v1/namespaces/default/pods')
          .reply(HttpStatus.UNAUTHORIZED, errorMessage);

        // Act & Assert
        await expect(
          kubernetesClient.listResources<KubernetesResource>(
            apiVersion,
            kind,
            namespace,
          ),
        ).rejects.toThrow(ApiError);

        expect(mockedLogger.error).toHaveBeenNthCalledWith(
          3,
          expect.stringContaining(
            `[listResources] Failed to list resources of kind Pod: Request failed with status code 401`,
          ),
          expect.objectContaining({
            responseBody: errorMessage,
          }),
        );

        // Verify that the request was made as expected
        expect(nock.isDone()).toBe(true);
      });
    });

    /**
     * Test Suite for createResource Method
     */
    describe('createResource', () => {
      const apiVersion = 'v1';
      const kind = 'Pod';
      const namespace = 'default';
      const resourcePath = '/api/v1/namespaces/default/pods';
      const mockResource: KubernetesResource = {
        apiVersion,
        kind,
        metadata: { name: 'new-pod', namespace },
        // ...other properties
      };

      it('should create a resource successfully', async () => {
        // Arrange
        const responseData = { ...mockResource };
        nock('https://127.0.0.1:6443')
          .post('/api/v1/namespaces/default/pods')
          .reply(HttpStatus.CREATED, responseData);

        // Act
        const result =
          await kubernetesClient.createResource<KubernetesResource>(
            mockResource,
            namespace,
          );

        // Assert
        expect(result).toEqual(mockResource);
        expect(mockedLogger.debug).toHaveBeenCalledWith(
          `Creating resource of kind: ${kind}, name: ${mockResource.metadata.name}, namespace: ${namespace}`,
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          `[createResource] Creating resource: Pod with name: new-pod in namespace: default`,
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          `[createResource] Success: Creating resource: Pod with name: new-pod in namespace: default`,
        );

        // Verify that the request was made as expected
        expect(nock.isDone()).toBe(true);
      });

      it('should throw ApiError when resource creation fails', async () => {
        // Arrange
        const errorMessage = 'Conflict';
        nock('https://127.0.0.1:6443')
          .post('/api/v1/namespaces/default/pods')
          .reply(HttpStatus.CONFLICT, errorMessage);

        // Act & Assert
        await expect(
          kubernetesClient.createResource<KubernetesResource>(
            mockResource,
            namespace,
          ),
        ).rejects.toThrow(ApiError);

        expect(mockedLogger.error).toHaveBeenNthCalledWith(
          3,
          expect.stringContaining(
            `[createResource] Failed to create resource Pod with name new-pod: Request failed with status code ${HttpStatus.CONFLICT}`,
          ),
          expect.objectContaining({
            responseBody: errorMessage,
          }),
        );

        // Verify that the request was made as expected
        expect(nock.isDone()).toBe(true);
      });
    });

    /**
     * Test Suite for updateResource Method
     */
    describe('updateResource', () => {
      const apiVersion = 'v1';
      const kind = 'Pod';
      const name = 'existing-pod';
      const namespace = 'default';
      const resourcePath = '/api/v1/namespaces/default/pods/existing-pod';
      const mockResource: KubernetesResource = {
        apiVersion,
        kind,
        metadata: { name, namespace },
        // ...other properties
      };

      it('should update a resource successfully', async () => {
        // Arrange
        const updatedResource = {
          ...mockResource,
          metadata: { ...mockResource.metadata, labels: { app: 'updated' } },
        };
        nock('https://127.0.0.1:6443')
          .put('/api/v1/namespaces/default/pods/existing-pod')
          .reply(HttpStatus.OK, updatedResource);

        // Act
        const result =
          await kubernetesClient.updateResource<KubernetesResource>(
            updatedResource,
            namespace,
          );

        // Assert
        expect(result).toEqual(updatedResource);
        expect(mockedLogger.debug).toHaveBeenCalledWith(
          `Updating resource of kind: ${kind}, name: ${name}, namespace: ${namespace}`,
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          `[updateResource] Updating resource: Pod with name: existing-pod in namespace: default`,
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          `[updateResource] Success: Updating resource: Pod with name: existing-pod in namespace: default`,
        );

        // Verify that the request was made as expected
        expect(nock.isDone()).toBe(true);
      });

      it('should throw ApiError when resource update fails', async () => {
        // Arrange
        const errorMessage = 'Forbidden';
        nock('https://127.0.0.1:6443')
          .put('/api/v1/namespaces/default/pods/existing-pod')
          .reply(HttpStatus.FORBIDDEN, errorMessage);

        // Act & Assert
        await expect(
          kubernetesClient.updateResource<KubernetesResource>(
            mockResource,
            namespace,
          ),
        ).rejects.toThrow(ApiError);

        expect(mockedLogger.error).toHaveBeenNthCalledWith(
          3,
          expect.stringContaining(
            `[updateResource] Failed to update resource Pod with name existing-pod: Request failed with status code ${HttpStatus.FORBIDDEN}`,
          ),
          expect.objectContaining({
            responseBody: errorMessage,
          }),
        );

        // Verify that the request was made as expected
        expect(nock.isDone()).toBe(true);
      });
    });

    /**
     * Test Suite for deleteResource Method
     */
    describe('deleteResource', () => {
      const apiVersion = 'v1';
      const kind = 'Pod';
      const name = 'deletable-pod';
      const namespace = 'default';

      it('should delete a resource successfully', async () => {
        // Arrange
        nock('https://127.0.0.1:6443')
          .delete('/api/v1/namespaces/default/pods/deletable-pod')
          .reply(HttpStatus.NO_CONTENT);

        // Act
        await kubernetesClient.deleteResource(
          apiVersion,
          kind,
          name,
          namespace,
        );

        // Assert
        expect(mockedLogger.debug).toHaveBeenCalledWith(
          `Deleting resource of kind: ${kind}, name: ${name}, namespace: ${namespace}`,
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          `[deleteResource] Deleting resource: Pod with name: deletable-pod in namespace: default`,
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          `[deleteResource] Success: Deleting resource: Pod with name: deletable-pod in namespace: default`,
        );

        // Verify that the nock request was used
        expect(nock.isDone()).toBe(true);
      });

      it('should throw ApiError when resource deletion fails', async () => {
        // Arrange
        const errorMessage = 'Not Found';
        nock('https://127.0.0.1:6443')
          .delete('/api/v1/namespaces/default/pods/deletable-pod')
          .reply(HttpStatus.NOT_FOUND, errorMessage);

        // Act & Assert
        await expect(
          kubernetesClient.deleteResource(apiVersion, kind, name, namespace),
        ).rejects.toThrow(ApiError);

        expect(mockedLogger.error).toHaveBeenNthCalledWith(
          3,
          expect.stringContaining(
            `[deleteResource] Failed to delete resource Pod with name deletable-pod: Request failed with status code ${HttpStatus.NOT_FOUND}`,
          ),
          expect.objectContaining({
            responseBody: errorMessage,
          }),
        );

        // Verify that the nock request was used
        expect(nock.isDone()).toBe(true);
      });
    });

    /**
     * Test Suite for getPodLogs Method
     */
    describe('getPodLogs', () => {
      const name = 'log-pod';
      const namespace = 'default';
      const container = 'nginx';
      const basePath = `/api/v1/namespaces/${namespace}/pods/${name}/log`;
      const resourcePath = `${basePath}?container=${encodeURIComponent(container)}`;

      it('should fetch pod logs successfully with container specified', async () => {
        // Arrange
        const mockLogs = 'Pod logs content';
        nock('https://127.0.0.1:6443')
          .get(resourcePath)
          .reply(HttpStatus.OK, mockLogs);

        // Act
        const logs = await kubernetesClient.getPodLogs(
          name,
          namespace,
          container,
        );

        // Assert
        expect(logs).toBe(mockLogs);
        expect(mockedLogger.debug).toHaveBeenCalledWith(
          `Fetching logs for pod: ${name}, namespace: ${namespace}, container: ${container}`,
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          `[getPodLogs] Fetching logs for pod: log-pod in namespace: default`,
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          `[getPodLogs] Success: Fetching logs for pod: log-pod in namespace: default`,
        );

        // Verify that the nock request was used
        expect(nock.isDone()).toBe(true);
      });

      it('should fetch pod logs successfully without specifying container', async () => {
        // Arrange
        const mockLogs = 'Pod logs without container';
        const resourcePath = `/api/v1/namespaces/${namespace}/pods/${name}/log`;

        nock('https://127.0.0.1:6443')
          .get(resourcePath)
          .reply(HttpStatus.OK, mockLogs);

        // Act
        const logs = await kubernetesClient.getPodLogs(name, namespace);

        // Assert
        expect(logs).toBe(mockLogs);

        // Verify that the nock request was used
        expect(nock.isDone()).toBe(true);
      });

      it('should throw ApiError when fetching pod logs fails', async () => {
        // Arrange
        const errorMessage = 'Internal Server Error';
        nock('https://127.0.0.1:6443')
          .get(resourcePath)
          .reply(HttpStatus.INTERNAL_SERVER_ERROR, errorMessage);

        // Act & Assert
        await expect(
          kubernetesClient.getPodLogs(name, namespace, container),
        ).rejects.toThrow(ApiError);

        expect(mockedLogger.error).toHaveBeenNthCalledWith(
          3,
          expect.stringContaining(
            `[getPodLogs] Failed to fetch logs for pod log-pod: Request failed with status code ${HttpStatus.INTERNAL_SERVER_ERROR}`,
          ),
          expect.objectContaining({
            responseBody: errorMessage,
          }),
        );

        // Verify that the nock request was used
        expect(nock.isDone()).toBe(true);
      });
    });

    /**
     * Test Suite for watchResource Method
     */
    // describe('watchResource', () => {
    //   beforeEach(() => {
    //     nock.enableNetConnect(); // Temporarily allow real network connections for debugging
    //     jest.setTimeout(10000); // Increase timeout for watch tests
    //   });
    //   afterEach(() => {
    //     nock.cleanAll();
    //     nock.enableNetConnect(); // Re-enable network connections
    //   });

    //   const apiVersion = 'v1'; // For core API group
    //   const kind = 'Pod';
    //   const namespace = 'default';
    //   const labelSelector = 'app=frontend';
    //   const fieldSelector = 'status.phase=Running';

    //   const mockWatchEvents: WatchEvent<KubernetesResource>[] = [
    //     {
    //       type: 'ADDED',
    //       object: {
    //         apiVersion: 'v1',
    //         kind: 'Pod',
    //         metadata: { name: 'pod1', namespace: 'default' },
    //       },
    //     },
    //     {
    //       type: 'MODIFIED',
    //       object: {
    //         apiVersion: 'v1',
    //         kind: 'Pod',
    //         metadata: { name: 'pod1', namespace: 'default' },
    //       },
    //     },
    //     {
    //       type: 'DELETED',
    //       object: {
    //         apiVersion: 'v1',
    //         kind: 'Pod',
    //         metadata: { name: 'pod1', namespace: 'default' },
    //       },
    //     },
    //   ];

    //   // Helper function to generate the correct resource path
    //   const generateResourcePath = (
    //     apiVersion: string,
    //     kind: string,
    //     namespace: string,
    //   ): string => {
    //     const [apiGroup, version] = apiVersion.includes('/')
    //       ? apiVersion.split('/')
    //       : ['', apiVersion];
    //     const resourceName =
    //       KindToResourceNameMap[kind] || kind.toLowerCase() + 's';
    //     let path = apiGroup
    //       ? `/apis/${apiGroup}/${version}`
    //       : `/api/${version}`;
    //     path += `/namespaces/${namespace}/${resourceName}`;
    //     return path;
    //   };

    //   const resourcePath = generateResourcePath(apiVersion, kind, namespace);

    // it('should watch resources and yield watch events successfully', async () => {
    //   // Arrange
    //   const stream = new PassThrough();

    //   const scope = nock('https://127.0.0.1:6443')
    //     .get('/api/v1/namespaces/default/pods')
    //     .query({
    //       watch: 'true',
    //       labelSelector: 'app=frontend',
    //       fieldSelector: 'status.phase=Running',
    //     })
    //     .reply(200, stream, { 'Content-Type': 'application/json' });

    //   // Emit events with delays to simulate streaming
    //   mockWatchEvents.forEach((event, index) => {
    //     setTimeout(() => {
    //       stream.write(JSON.stringify(event) + '\n');
    //       if (index === mockWatchEvents.length - 1) {
    //         stream.end(); // Signal the end of the stream
    //       }
    //     }, index * 50); // Delay each event by 50ms
    //   });

    //   // Act
    //   const watch = kubernetesClient.watchResource<KubernetesResource>(
    //     apiVersion,
    //     kind,
    //     namespace,
    //     labelSelector,
    //     fieldSelector,
    //   );
    //   const events: WatchEvent<KubernetesResource>[] = [];
    //   for await (const event of watch) {
    //     events.push(event);
    //     if (events.length === mockWatchEvents.length) {
    //       break;
    //     }
    //   }

    //   // Assert
    //   expect(events).toEqual(mockWatchEvents);
    //   expect(mockedLogger.debug).toHaveBeenCalledWith(
    //     `Watching resource of kind: ${kind}, namespace: ${namespace}`,
    //   );
    //   expect(mockedLogger.info).toHaveBeenCalledWith(
    //     `[watchResource] Watching resource of kind: Pod in namespace: default`,
    //   );
    //   expect(mockedLogger.info).toHaveBeenCalledWith(
    //     `[watchResource] Success: Watching resource of kind: Pod in namespace: default`,
    //   );

    //   // Verify that the request was made as expected
    //   expect(scope.isDone()).toBe(true); // Ensures all nock interceptors were satisfied
    // });
    // it('should throw a ParsingError when a watch event JSON is invalid', async () => {
    //   // Arrange
    //   const invalidWatchData = `{"type": "ADDED", "object": {"apiVersion": "v1", "kind": "Pod", "metadata": {"name": "pod1", "namespace": "default"}}}\nInvalid JSON\n`;

    //   nock('https://127.0.0.1:6443')
    //     .get(resourcePath)
    //     .query((actualQuery) => {
    //       return (
    //         actualQuery.watch === 'true' &&
    //         actualQuery.labelSelector === 'app=frontend' &&
    //         actualQuery.fieldSelector === 'status.phase=Running'
    //       );
    //     })
    //     .reply(200, invalidWatchData, { 'Content-Type': 'application/json' });

    //   // Act
    //   const watch = kubernetesClient.watchResource<KubernetesResource>(
    //     apiVersion,
    //     kind,
    //     namespace,
    //     labelSelector,
    //     fieldSelector,
    //   );

    //   // Assert
    //   const promise = (async () => {
    //     const events: WatchEvent<KubernetesResource>[] = [];
    //     for await (const event of watch) {
    //       events.push(event);
    //     }
    //   })();

    //   await expect(promise).rejects.toThrow(ParsingError);
    //   await expect(promise).rejects.toThrow(
    //     'Failed to parse watch event JSON',
    //   );

    //   expect(mockedLogger.error).toHaveBeenCalledWith(
    //     'Failed to parse watch event JSON: Unexpected token I in JSON at position 0',
    //   );
    // });
  });
  /**
   * Test Suite for Error Handling
   */
  describe('Error Handling', () => {
    const apiVersion = 'v1';
    const kind = 'Pod';
    const name = 'error-pod';
    const namespace = 'default';
    const resourcePath = '/api/v1/namespaces/default/pods/error-pod';

    it('should handle unexpected errors and throw Error', async () => {
      // Arrange
      const unexpectedErrorMessage = 'Unexpected failure';
      nock('https://127.0.0.1:6443')
        .get(resourcePath)
        .replyWithError(unexpectedErrorMessage);

      // Act & Assert
      await expect(
        kubernetesClient.getResource<KubernetesResource>(
          apiVersion,
          kind,
          name,
          namespace,
        ),
      ).rejects.toThrow(
        NetworkError || ParsingError || ApiError || ClientError,
      );

      // Check that the error message prefix was logged
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `[getResource] Failed to fetch resource Pod with name error-pod`,
        ),
        expect.objectContaining({
          originalError: expect.any(Error), // Ensure an error object is logged
        }),
      );
    });
  });

  /**
   * Test Suite for executeWithLogging Method
   * Note: This is a private method, so it's tested indirectly via public methods.
   * However, you can expose it via some means (e.g., using a testing utility) if needed.
   */
  // Skipping direct tests for private methods as they are tested via public interface

  /**
   * Test Suite for Error Handling
   */

  describe('Error Handling', () => {
    const apiVersion = 'v1';
    const kind = 'Pod';
    const name = 'error-pod';
    const namespace = 'default';
    const resourcePath = '/api/v1/namespaces/default/pods/error-pod';

    it('should handle unexpected errors and throw Error', async () => {
      // Arrange
      const unexpectedErrorMessage = 'Unexpected failure';
      nock('https://127.0.0.1:6443')
        .get(resourcePath)
        .replyWithError(unexpectedErrorMessage);

      // Act & Assert
      await expect(
        kubernetesClient.getResource<KubernetesResource>(
          apiVersion,
          kind,
          name,
          namespace,
        ),
      ).rejects.toThrow(
        NetworkError || ParsingError || ApiError || ClientError,
      );

      // Check that the error message prefix was logged
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `[getResource] Failed to fetch resource Pod with name error-pod`,
        ),
        expect.objectContaining({
          originalError: expect.any(Error), // Ensure an error object is logged
        }),
      );
    });
  });
});
