// src/clients/KubernetesClient.test.ts

import { KubernetesClient } from './KubernetesClient';
import { KubeConfigReader } from '../utils';
import { ResolvedKubeConfig, KubernetesResource, WatchEvent } from '../models';
import {
  ApiError,
  ClientError,
  KubeConfigError,
  NetworkError,
  ParsingError,
} from '../errors';
import https, { RequestOptions } from 'https';
import { IFileSystem, ILogger } from '../interfaces';
import { EventEmitter, Readable } from 'stream';
import { ClientRequest, IncomingMessage } from 'http';

// Mock dependencies
jest.mock('../utils/KubeConfigReader');
jest.mock('../utils/Logger');

type ReadFileMock = jest.Mock<
  Promise<string>,
  [path: string, encoding: BufferEncoding]
> &
  jest.Mock<Promise<Buffer>, [path: string]>;

const readFileMock: ReadFileMock = jest.fn(
  (path: string, encoding?: BufferEncoding): Promise<string | Buffer> => {
    if (encoding === 'utf8') {
      // Return string data for PEM-encoded files
      switch (path) {
        case '/mock/.kube/config':
          return Promise.resolve(kubeconfigYaml);
        case 'mock-ca-path':
          return Promise.resolve(`-----BEGIN CERTIFICATE-----
  MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
  ...
  -----END CERTIFICATE-----`);
        case 'mock-client-cert-path':
          return Promise.resolve(`-----BEGIN CERTIFICATE-----
  MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
  ...
  -----END CERTIFICATE-----`);
        case 'mock-client-key-path':
          return Promise.resolve(`-----BEGIN PRIVATE KEY-----
  MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...
  -----END PRIVATE KEY-----`);
        default:
          return Promise.resolve(''); // Default string response
      }
    } else {
      // Return Buffer data for non-UTF8 encodings
      switch (path) {
        case 'mock-ca-path':
          return Promise.resolve(Buffer.from('mock-ca-cert'));
        default:
          return Promise.resolve(Buffer.from('')); // Default Buffer response
      }
    }
  },
) as ReadFileMock;

const createMockFileSystem = (): jest.Mocked<IFileSystem> => ({
  readFile: readFileMock, // Assign the custom ReadFileMock
  access: jest.fn(),
});

const kubeconfigYaml = `
apiVersion: v1
clusters:
  - name: test-cluster
    cluster:
      server: https://localhost:6443
      certificate-authority-data: |
        -----BEGIN CERTIFICATE-----
        MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
        UzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UE
        CwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUy
        MVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkG
        A1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcN
        AQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq
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
      client-certificate-data: |
        -----BEGIN CERTIFICATE-----
        MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
        UzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UE
        CwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUy
        MVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkG
        A1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcN
        AQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq
        ...
        -----END CERTIFICATE-----
      client-key-data: |
        -----BEGIN PRIVATE KEY-----
        MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...
        -----END PRIVATE KEY-----
`;

describe('KubernetesClient', () => {
  let mockKubeConfig: ResolvedKubeConfig;
  let mockLogger: jest.Mocked<ILogger>;
  let mockFileSystem: jest.Mocked<IFileSystem>;

  beforeAll(() => {
    // Create mock logger instance
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
      verbose: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock kubeConfig
    mockKubeConfig = {
      cluster: {
        server: 'https://mock-server',
        certificateAuthority: 'mock-ca-path',
      },
      user: {
        token: 'mock-token',
      },
    };

    // Setup KubeConfigReader mock implementation
    (
      KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
    ).prototype.getKubeConfig = jest.fn().mockResolvedValue(mockKubeConfig);
    (
      KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
    ).prototype.getInClusterConfig = jest
      .fn()
      .mockResolvedValue(mockKubeConfig);

    // Setup mock FileSystem
    mockFileSystem = createMockFileSystem();
  });

  // Helper function to mock https.request using jest.spyOn
  const mockHttpsRequest = (
    statusCode: number,
    responseData: any,
    shouldParseJson: boolean = true,
  ) => {
    // Create a mock IncomingMessage
    const res = new Readable() as IncomingMessage;
    res.statusCode = statusCode;
    res.headers = {};

    if (shouldParseJson && responseData !== null) {
      res.push(JSON.stringify(responseData));
    } else if (responseData !== null) {
      res.push(responseData); // For plain text responses like logs
    }
    res.push(null); // End of response

    // Create a mock ClientRequest
    const req = {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    } as Partial<ClientRequest> as ClientRequest;

    // Spy on https.request and mock its implementation
    jest
      .spyOn(https, 'request')
      .mockImplementation(
        (
          urlOrOptions: string | URL | RequestOptions,
          optionsOrCallback?: RequestOptions | ((res: IncomingMessage) => void),
          callback?: (res: IncomingMessage) => void,
        ): ClientRequest => {
          let cb: (res: IncomingMessage) => void;

          if (typeof optionsOrCallback === 'function') {
            cb = optionsOrCallback;
          } else {
            cb = callback!;
          }

          cb(res);
          return req;
        },
      );

    return req;
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('KubernetesClient Constructor', () => {
    let mockKubeConfig: ResolvedKubeConfig;
    let mockLogger: jest.Mocked<ILogger>;
    let mockFileSystem: jest.Mocked<IFileSystem>;

    beforeAll(() => {
      // Set up mock logger instance
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        setLogLevel: jest.fn(),
        verbose: jest.fn(),
      };
    });

    beforeEach(() => {
      jest.clearAllMocks();

      // Mock kubeConfig object with basic structure
      mockKubeConfig = {
        cluster: {
          server: 'https://mock-server',
          certificateAuthority: 'mock-ca-path',
        },
        user: {
          token: 'mock-token',
        },
      };

      // Mock KubeConfigReader behavior
      (
        KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
      ).prototype.getKubeConfig.mockResolvedValue(mockKubeConfig);

      // Mock file system
      mockFileSystem = {
        readFile: jest.fn(),
        access: jest.fn(),
      } as unknown as jest.Mocked<IFileSystem>;
    });

    it('should initialize successfully with default kubeconfig path', async () => {
      const client = await KubernetesClient.create({
        fileSystem: mockFileSystem,
        logger: mockLogger,
      });

      expect(client).toBeInstanceOf(KubernetesClient);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loading kube config from file.',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loaded kube config from default path.',
      );
    });

    it('should initialize successfully with a custom kubeconfig path', async () => {
      const kubeConfigPath = '/custom/kubeconfig/path';

      const client = await KubernetesClient.create({
        kubeConfigPath,
        fileSystem: mockFileSystem,
        logger: mockLogger,
      });

      expect(client).toBeInstanceOf(KubernetesClient);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loading kube config from file.',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Loaded kube config from ${kubeConfigPath}.`,
      );
    });

    it('should attempt to load in-cluster config if file config fails', async () => {
      // Mock the getKubeConfig to throw KubeConfigError
      (
        KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
      ).prototype.getKubeConfig.mockRejectedValue(
        new KubeConfigError('Failed to load kubeconfig from file.'),
      );

      // Mock in-cluster config resolution
      (
        KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
      ).prototype.getInClusterConfig.mockResolvedValue(mockKubeConfig);

      const client = await KubernetesClient.create({
        fileSystem: mockFileSystem,
        logger: mockLogger,
      });

      expect(client).toBeInstanceOf(KubernetesClient);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to load kubeconfig from file. Attempting to load in-cluster config.',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loaded in-cluster kube config.',
      );
    });

    it('should throw a ClientError if both file and in-cluster config loading fail', async () => {
      // Mock both getKubeConfig and getInClusterConfig to throw errors
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

      await expect(
        KubernetesClient.create({
          fileSystem: mockFileSystem,
          logger: mockLogger,
        }),
      ).rejects.toThrow(ClientError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load in-cluster kube config.',
        expect.any(KubeConfigError),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load in-cluster kube config.',
        expect.any(KubeConfigError),
      );
    });

    it('should throw unexpected errors during initialization', async () => {
      const unexpectedError = new Error('Unexpected error occurred');

      (
        KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
      ).prototype.getKubeConfig.mockRejectedValue(unexpectedError);

      await expect(
        KubernetesClient.create({
          fileSystem: mockFileSystem,
          logger: mockLogger,
        }),
      ).rejects.toThrow('Unexpected error occurred');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error while loading kube config.',
        unexpectedError,
      );
    });

    it('should fallback to in-cluster config if default kubeConfig not found', async () => {
      // Mock the getKubeConfig method to throw a KubeConfigError
      (
        KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
      ).prototype.getKubeConfig.mockRejectedValue(
        new KubeConfigError('Failed to load kubeconfig from file.'),
      );

      // Mock the getInClusterConfig to resolve with a valid configuration
      (
        KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
      ).prototype.getInClusterConfig.mockResolvedValue(mockKubeConfig);

      // Mock readFile for certificateAuthority
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (path: string, encoding?: BufferEncoding): Promise<string | Buffer> => {
          if (path === 'mock-ca-path') {
            return Promise.resolve(`-----BEGIN CERTIFICATE-----
    MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
    ...
    -----END CERTIFICATE-----`);
          }
          return Promise.resolve(Buffer.from(''));
        },
      );

      // Attempt to create the KubernetesClient
      const client = await KubernetesClient.create({
        fileSystem: mockFileSystem,
        logger: mockLogger, // Pass the mocked logger here
      });

      // Verify that the client instance is created successfully
      expect(client).toBeInstanceOf(KubernetesClient);

      // Verify that appropriate log messages were recorded
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loading kube config from file.',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to load kubeconfig from file. Attempting to load in-cluster config.',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loaded in-cluster kube config.',
      );
    });
  });

  describe('API Operations', () => {
    let client: KubernetesClient;

    beforeEach(async () => {
      // Mock readFile to return string for 'utf8' encoding and Buffer otherwise
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (path: string, encoding?: BufferEncoding): Promise<string | Buffer> => {
          if (encoding === 'utf8') {
            // Return string data for PEM-encoded files
            switch (path) {
              case 'mock-ca-path':
                return Promise.resolve(`-----BEGIN CERTIFICATE-----
  MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
  ...
  -----END CERTIFICATE-----`);
              case 'mock-client-cert-path':
                return Promise.resolve(`-----BEGIN CERTIFICATE-----
  MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
  ...
  -----END CERTIFICATE-----`);
              case 'mock-client-key-path':
                return Promise.resolve(`-----BEGIN PRIVATE KEY-----
  MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...
  -----END PRIVATE KEY-----`);
              default:
                return Promise.resolve(''); // Default string response
            }
          } else {
            // Return Buffer data for non-UTF8 encodings
            switch (path) {
              case 'mock-ca-path':
                return Promise.resolve(Buffer.from('mock-ca-cert'));
              default:
                return Promise.resolve(Buffer.from('')); // Default Buffer response
            }
          }
        },
      );

      // Initialize the client with the mocked file system
      client = await KubernetesClient.create({
        fileSystem: mockFileSystem,
      });
    });

    describe('getResource', () => {
      it('should fetch a resource', async () => {
        const mockResponse = {
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: { name: 'mock-pod' },
        };

        mockHttpsRequest(200, mockResponse);

        const result = await client.getResource('v1', 'Pod', 'mock-pod');
        expect(result).toEqual(mockResponse);
      });

      it('should handle API error in createResource', async () => {
        mockHttpsRequest(400, 'Bad Request');
        const mockResource = {
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: { name: 'mock-pod' },
        };

        await expect(client.createResource(mockResource)).rejects.toThrow(
          ApiError,
        );
      });

      describe('getResource', () => {
        it('should handle fetching a non-existent resource', async () => {
          mockHttpsRequest(404, 'Not Found');
          await expect(
            client.getResource('v1', 'Pod', 'non-existent-pod'),
          ).rejects.toThrow(ApiError);
        });

        it('should handle authorization errors when fetching a resource', async () => {
          mockHttpsRequest(403, 'Forbidden');
          await expect(
            client.getResource('v1', 'Pod', 'restricted-pod'),
          ).rejects.toThrow(ApiError);
        });
      });

      describe('listResources', () => {
        it('should list resources using label and field selectors', async () => {
          const mockResponse = {
            items: [
              { apiVersion: 'v1', kind: 'Pod', metadata: { name: 'mock-pod' } },
            ],
          };
          mockHttpsRequest(200, mockResponse);

          const resources = await client.listResources(
            'v1',
            'Pod',
            'default',
            'env=test',
            'status=Running',
          );
          expect(resources).toEqual(mockResponse.items);
        });

        it('should handle listing resources in a non-existent namespace', async () => {
          mockHttpsRequest(404, 'Namespace Not Found');
          await expect(
            client.listResources('v1', 'Pod', 'non-existent-namespace'),
          ).rejects.toThrow(ApiError);
        });
      });

      describe('createResource', () => {
        it('should handle creating a resource with missing required fields', async () => {
          const mockResource: KubernetesResource = {
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: { name: '' },
          }; // Missing fields
          mockHttpsRequest(400, 'Bad Request');

          await expect(client.createResource(mockResource)).rejects.toThrow(
            ApiError,
          );
        });

        it('should handle creating a resource that already exists', async () => {
          const mockResource: KubernetesResource = {
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: { name: 'existing-pod' },
          };
          mockHttpsRequest(409, 'Conflict');

          await expect(client.createResource(mockResource)).rejects.toThrow(
            ApiError,
          );
        });

        it('should create a resource', async () => {
          const mockResource: KubernetesResource = {
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: { name: 'mock-pod' },
          };

          mockHttpsRequest(201, mockResource);

          const resource = await client.createResource(mockResource);

          expect(resource).toEqual(mockResource);
        });

        it('should throw an error if request fails', async () => {
          const mockResource: KubernetesResource = {
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: { name: 'mock-pod' },
          };

          mockHttpsRequest(400, 'Bad Request');

          await expect(client.createResource(mockResource)).rejects.toThrow(
            ApiError,
          );
        });
      });

      it('should throw an error if request fails', async () => {
        mockHttpsRequest(404, 'Not Found');

        await expect(
          client.getResource('v1', 'Pod', 'mock-pod'),
        ).rejects.toThrow(ApiError);
      });

      it('should generate correct resource path for namespaced resources', async () => {
        const client = await KubernetesClient.create({
          kubeConfigPath: 'mock-path',
          fileSystem: mockFileSystem,
        });
        const path = client['getResourcePath'](
          'v1',
          'Pod',
          'mock-pod',
          'mock-namespace',
        );

        expect(path).toBe('/api/v1/namespaces/mock-namespace/pods/mock-pod');
      });
    });

    describe('updateResource', () => {
      it('should handle updating a non-existent resource', async () => {
        const mockResource: KubernetesResource = {
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: { name: 'non-existent-pod' },
        };
        mockHttpsRequest(404, 'Not Found');

        await expect(client.updateResource(mockResource)).rejects.toThrow(
          ApiError,
        );
      });

      it('should handle version conflicts when updating a resource', async () => {
        const mockResource: KubernetesResource = {
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: { name: 'outdated-pod' },
        };
        mockHttpsRequest(409, 'Conflict');

        await expect(client.updateResource(mockResource)).rejects.toThrow(
          ApiError,
        );
      });
      it('should update a resource', async () => {
        const mockResource: KubernetesResource = {
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: { name: 'mock-pod' },
        };

        mockHttpsRequest(200, mockResource);

        const resource = await client.updateResource(mockResource);

        expect(resource).toEqual(mockResource);
      });

      it('should throw an error if request fails', async () => {
        const mockResource: KubernetesResource = {
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: { name: 'mock-pod' },
        };

        mockHttpsRequest(400, 'Bad Request');

        await expect(client.updateResource(mockResource)).rejects.toThrow(
          ApiError,
        );
      });
    });

    describe('deleteResource', () => {
      it('should delete a resource', async () => {
        mockHttpsRequest(204, null, false); // 204 No Content

        await expect(
          client.deleteResource('v1', 'Pod', 'mock-pod'),
        ).resolves.toBeUndefined();
      });

      it('should throw an error if request fails', async () => {
        mockHttpsRequest(404, 'Not Found', false);

        await expect(
          client.deleteResource('v1', 'Pod', 'mock-pod'),
        ).rejects.toThrow(ApiError);
      });

      it('should handle deleting a resource without sufficient permissions', async () => {
        mockHttpsRequest(403, 'Forbidden');
        await expect(
          client.deleteResource('v1', 'Pod', 'restricted-pod'),
        ).rejects.toThrow(ApiError);
      });
    });

    describe('getPodLogs', () => {
      it('should fetch pod logs', async () => {
        const mockLogs = 'mock logs';
        mockHttpsRequest(200, mockLogs, false); // Plain text

        const logs = await client.getPodLogs('mock-pod', 'mock-namespace');
        expect(logs).toEqual(mockLogs);
      });

      it('should throw an error if request fails', async () => {
        mockHttpsRequest(404, 'Not Found', false);

        await expect(
          client.getPodLogs('mock-pod', 'mock-namespace'),
        ).rejects.toThrow(ApiError);
      });

      it('should fetch logs of a specific pod', async () => {
        const mockLogs = 'Sample pod logs';
        mockHttpsRequest(200, mockLogs, false); // Plain text response

        const client = await KubernetesClient.create({
          fileSystem: mockFileSystem,
        });
        const logs = await client.getPodLogs(
          'mock-pod',
          'mock-namespace',
          'mock-container',
        );

        expect(logs).toEqual(mockLogs);
      });

      it('should handle large log outputs', async () => {
        const mockLogs = 'large log output'.repeat(1000);
        mockHttpsRequest(200, mockLogs, false);

        const logs = await client.getPodLogs('mock-pod', 'default');
        expect(logs).toEqual(mockLogs);
      });
    });

    describe('watchResource', () => {
      it('should watch a resource and yield events', async () => {
        const mockEvent: WatchEvent<KubernetesResource> = {
          type: 'ADDED',
          object: {
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: { name: 'mock-pod' },
          },
        };

        // Create a mock Readable stream for the response
        const mockResponse = new Readable({
          read() {
            // Simulate sending data
            this.push(JSON.stringify(mockEvent) + '\n');
            this.push(null); // End of stream
          },
        }) as IncomingMessage;

        // Create a mock ClientRequest with necessary methods
        const mockRequest = new EventEmitter() as ClientRequest;
        mockRequest.end = jest.fn();
        mockRequest.on = jest.fn();

        // Mock https.request to return the mockRequest and invoke the callback with mockResponse
        jest
          .spyOn(https, 'request')
          .mockImplementation(
            (
              urlOrOptions: string | URL | RequestOptions,
              optionsOrCallback?:
                | RequestOptions
                | ((res: IncomingMessage) => void),
              callback?: (res: IncomingMessage) => void,
            ): ClientRequest => {
              // Invoke the callback with the mock response
              if (typeof optionsOrCallback === 'function') {
                optionsOrCallback(mockResponse);
              } else if (typeof callback === 'function') {
                callback(mockResponse);
              }

              return mockRequest;
            },
          );

        const events = client.watchResource('v1', 'Pod', 'mock-namespace');
        const result = [];
        for await (const event of events) {
          result.push(event);
        }

        expect(result).toEqual([mockEvent]);
        expect(mockRequest.end).toHaveBeenCalled();
      });

      it('should handle JSON parsing error in watchResource', async () => {
        const malformedEvent = '{"type": "ADDED", "object": { invalid-json';
        const mockResponse = new Readable({
          read() {
            // Push malformed JSON data to trigger a parsing error in watchResource
            this.push(malformedEvent);
            this.push(null); // End the stream
          },
        }) as IncomingMessage;

        const mockRequest = new EventEmitter() as ClientRequest;
        mockRequest.end = jest.fn();
        mockRequest.on = jest.fn();

        jest
          .spyOn(https, 'request')
          .mockImplementation(
            (
              urlOrOptions: string | URL | RequestOptions,
              optionsOrCallback?:
                | RequestOptions
                | ((res: IncomingMessage) => void),
              callback?: (res: IncomingMessage) => void,
            ): ClientRequest => {
              if (typeof optionsOrCallback === 'function') {
                optionsOrCallback(mockResponse);
              } else if (callback) {
                callback(mockResponse);
              }
              return mockRequest;
            },
          );

        const events = client.watchResource('v1', 'Pod', 'mock-namespace');

        try {
          // Consume events from the generator and expect a throw
          for await (const event of events) {
            // No-op: expecting this loop to throw an error on JSON parsing
          }
          // Fail the test if no error is thrown
          throw new Error('Expected JSON parsing error, but none was thrown.');
        } catch (error) {
          expect(error.message).toContain('Failed to parse watch event JSON');
        }
      }, 10000); // Increase timeout for this test case

      it('should throw an error if request fails', async () => {
        // Create a mock ClientRequest with necessary methods
        const mockRequest = new EventEmitter() as ClientRequest;
        mockRequest.end = jest.fn();
        mockRequest.on = jest.fn().mockImplementation((event, handler) => {
          if (event === 'error') {
            process.nextTick(() => handler(new Error('Request failed')));
          }
          return mockRequest;
        });

        // Mock the https.request to return the mockRequest
        jest
          .spyOn(https, 'request')
          .mockImplementation(
            (
              urlOrOptions: string | URL | RequestOptions,
              optionsOrCallback?:
                | RequestOptions
                | ((res: IncomingMessage) => void),
              callback?: (res: IncomingMessage) => void,
            ): ClientRequest => {
              const mockResponse = new Readable({
                read() {
                  this.push(null); // No data
                },
              }) as IncomingMessage;

              if (typeof optionsOrCallback === 'function') {
                optionsOrCallback(mockResponse);
              } else if (typeof callback === 'function') {
                callback(mockResponse);
              }

              return mockRequest;
            },
          );

        const events = client.watchResource('v1', 'Pod', 'mock-namespace');

        // Attempt to get the next event, which should throw an error
        await expect(events.next()).rejects.toThrow('Error in watch stream.');

        expect(mockRequest.end).toHaveBeenCalled();
      });
    });

    it('should handle network interruptions gracefully', async () => {
      const mockResponse = new Readable({
        read() {
          this.push(null);
        },
      }) as IncomingMessage;

      const mockRequest = new EventEmitter() as ClientRequest;
      mockRequest.end = jest.fn();
      jest.spyOn(https, 'request').mockImplementation((_, __, callback) => {
        if (callback) callback(mockResponse);
        return mockRequest;
      });

      mockRequest.on = jest.fn().mockImplementation((event, handler) => {
        if (event === 'error') {
          process.nextTick(() => handler(new Error('Network interruption')));
        }
        return mockRequest;
      });

      const events = client.watchResource('v1', 'Pod', 'default');
      await expect(events.next()).rejects.toThrow('Error in watch stream.');
    });

    it('should pluralize kinds correctly', async () => {
      const client = await KubernetesClient.create({
        kubeConfigPath: 'mock-path',
        fileSystem: mockFileSystem,
        logger: mockLogger,
      });

      expect(client['pluralizeKind']('Pod')).toBe('pods');
      expect(client['pluralizeKind']('Watch')).toBe('watches');
      expect(client['pluralizeKind']('Service')).toBe('services');
    });
  });

  describe('KubernetesClient Error Handling', () => {
    it('should handle an API error (404 Not Found)', async () => {
      mockHttpsRequest(404, 'Not Found');
      const client = await KubernetesClient.create({
        kubeConfigPath: 'mock-path',
        fileSystem: mockFileSystem,
        logger: mockLogger,
      });

      await expect(
        client.getResource('v1', 'Pod', 'non-existent-pod'),
      ).rejects.toThrow(ApiError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Request failed with status code: 404',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[GET] Failed to make GET request to /api/v1/pods/non-existent-pod: Request failed with status code 404 (Status Code: 404)',
        {
          responseBody: '"Not Found"',
        },
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[getResource] Failed to fetch resource Pod with name non-existent-pod: Request failed with status code 404 (Status Code: 404)',
        {
          responseBody: '"Not Found"',
        },
      );
    });

    it('should handle a Network error', async () => {
      // Create a mock ClientRequest with necessary methods
      const mockRequest = new EventEmitter() as ClientRequest;
      mockRequest.end = jest.fn();
      mockRequest.on = jest.fn().mockImplementation((event, handler) => {
        if (event === 'error') {
          process.nextTick(() => handler(new Error('Network error occurred')));
        }
        return mockRequest;
      });

      // Mock the https.request to return the mockRequest
      jest
        .spyOn(https, 'request')
        .mockImplementation(
          (
            urlOrOptions: string | URL | RequestOptions,
            optionsOrCallback?:
              | RequestOptions
              | ((res: IncomingMessage) => void),
            callback?: (res: IncomingMessage) => void,
          ): ClientRequest => {
            return mockRequest;
          },
        );

      const client = await KubernetesClient.create({
        kubeConfigPath: 'mock-path',
        fileSystem: mockFileSystem,
        logger: mockLogger,
      });

      await expect(client.getResource('v1', 'Pod', 'mock-pod')).rejects.toThrow(
        NetworkError,
      );

      // Update assertions to check each logged error separately

      // Log for the initial request error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Request error: Network error occurred',
      );

      // Log for the execution of the GET request
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[GET] Failed to make GET request to /api/v1/pods/mock-pod: Network error occurred during the request.',
        {
          originalError: expect.any(Error),
        },
      );

      // Log for the resource-specific error
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[getResource] Failed to fetch resource Pod with name mock-pod: Network error occurred during the request.',
        {
          originalError: expect.any(Error),
        },
      );
    });

    it('should handle an unexpected error', async () => {
      // Force an unexpected error by throwing a generic error during request
      const unexpectedError = new Error('Unexpected error');
      jest.spyOn(https, 'request').mockImplementation(() => {
        throw unexpectedError;
      });

      const client = await KubernetesClient.create({
        kubeConfigPath: 'mock-path',
        fileSystem: mockFileSystem,
        logger: mockLogger,
      });

      await expect(client.getResource('v1', 'Pod', 'mock-pod')).rejects.toThrow(
        ClientError,
      );

      // Log for the unexpected error during GET request
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[GET] Failed to make GET request to /api/v1/pods/mock-pod: Unexpected error',
        unexpectedError,
      );

      // Log for the getResource method indicating failure
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[getResource] Failed to fetch resource Pod with name mock-pod: Unexpected error',
        expect.any(ClientError),
      );
    });
  });
});
