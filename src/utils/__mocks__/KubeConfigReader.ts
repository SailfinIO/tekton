// src/utils/__mocks__/KubeConfigReader.ts

export class KubeConfigReader {
  static getKubeConfig = jest.fn().mockResolvedValue('');
  static getInClusterConfig = jest.fn().mockResolvedValue('');
}

// Export the mocked class for type safety
export type MockedKubeConfigReader = jest.Mocked<typeof KubeConfigReader>;
