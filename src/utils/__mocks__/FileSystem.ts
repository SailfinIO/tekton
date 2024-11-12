// src/utils/__mocks__/FileSystem.ts

import { IFileSystem } from 'src/interfaces';
import { validKubeConfigYaml } from './kubeConfigMocks';

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
          return Promise.resolve(validKubeConfigYaml);
        case 'mock-ca-path':
          return Promise.resolve(
            `-----BEGIN CERTIFICATE-----\n${Buffer.from('valid-ca-cert').toString('base64')}\n-----END CERTIFICATE-----`,
          );
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
const accessMock = jest.fn<Promise<void>, [path: string, mode?: number]>();

export const createMockFileSystem = (): jest.Mocked<IFileSystem> => ({
  readFile: readFileMock, // Assign the custom ReadFileMock
  access: jest.fn(),
});

export class FileSystem implements IFileSystem {
  readFile = jest.fn().mockResolvedValue('');
  access = jest.fn().mockResolvedValue(undefined);
  constructor() {
    this.readFile = readFileMock;
  }
}

export const mockedReadFile = readFileMock;
export const mockedAccess = accessMock;
