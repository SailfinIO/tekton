// src/clients/KubernetesClient.test.ts

import { KubernetesClient } from './KubernetesClient';
import { KubeConfigReader } from '../utils';
import { ResolvedKubeConfig, KubernetesResource, WatchEvent } from '../models';
import { ApiError } from '../errors';
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

    // Set up static logger
    KubeConfigReader.logger = mockLogger;
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

  describe('create', () => {
    it('should create a resource', async () => {
      const mockResource: KubernetesResource = {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'mock-pod' },
      };

      mockHttpsRequest(201, mockResource);

      const client = await KubernetesClient.create({
        fileSystem: mockFileSystem,
      });

      const resource = await client.createResource(mockResource);

      expect(resource).toEqual(mockResource);
    });
    it('should throw an error if kubeConfig cannot be loaded', async () => {
      (
        KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
      ).prototype.getKubeConfig.mockResolvedValue(null);

      await expect(
        KubernetesClient.create({
          kubeConfigPath: 'mock-path',
          fileSystem: mockFileSystem,
        }),
      ).rejects.toThrow('Failed to load kubeconfig from path: mock-path');
    });

    it('should fallback to in-cluster config if default kubeConfig not found', async () => {
      (
        KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
      ).prototype.getKubeConfig.mockResolvedValue(null);

      (
        KubeConfigReader as jest.MockedClass<typeof KubeConfigReader>
      ).prototype.getInClusterConfig.mockResolvedValue(mockKubeConfig);

      // Mock readFile for certificateAuthority
      (mockFileSystem.readFile as jest.Mock).mockImplementation(
        (path: string, encoding?: BufferEncoding): Promise<string | Buffer> => {
          if (path === 'mock-ca-path') {
            return Promise.resolve(`-----BEGIN CERTIFICATE-----
MIIDdzCCAl+gAwIBAgIEbVYt0TANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
UzELMAkGA1UECAwCTlkxCzAJBgNVBAcMAk5ZMQswCQYDVQQKDAJOWTELMAkGA1UE
CwwCTlkxCzAJBgNVBAMMAk5ZMB4XDTIxMDYxNTEyMjUyMVoXDTMxMDYxMzEyMjUy
MVowbzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMQswCQYDVQQHDAJOWTELMAkG
A1UECgwCTlkxCzAJBgNVBAsMAk5ZMQswCQYDVQQDDAJOWTCCASIwDQYJKoZIhvcN
AQEBBQADggEPADCCAQoCggEBALw6NcMmsNqMYYGnIXJHjY58U0VThfqfzbjJGpYq
...
-----END CERTIFICATE-----`);
          }
          return Promise.resolve(Buffer.from(''));
        },
      );

      const client = await KubernetesClient.create({
        fileSystem: mockFileSystem,
      });
      expect(client).toBeInstanceOf(KubernetesClient);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Attempting to load kubeconfig from default path.',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Default kube config not found. Attempting to load in-cluster config.',
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

    describe('createResource', () => {
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

    describe('updateResource', () => {
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
        await expect(events.next()).rejects.toThrow('Request failed');

        expect(mockRequest.end).toHaveBeenCalled();
      });
    });
  });
});
