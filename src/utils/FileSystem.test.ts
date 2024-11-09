// File: FileSystem.test.ts

import { FileSystem } from './FileSystem';
import * as fsPromises from 'fs/promises';
import { constants } from 'fs';

// Mock the 'fs/promises' module
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  access: jest.fn(),
}));

// Optionally, mock 'fs/constants' if you use them directly
jest.mock('fs', () => ({
  constants: {
    F_OK: 0,
    // Add other constants if needed
  },
}));

describe('FileSystem', () => {
  let fileSystem: FileSystem;

  beforeEach(() => {
    fileSystem = new FileSystem();
    jest.clearAllMocks(); // Clear previous mocks to avoid interference
  });

  describe('readFile', () => {
    it('should read a file with encoding', async () => {
      const mockPath = 'mockPath';
      const mockEncoding: BufferEncoding = 'utf-8';
      const mockContent = 'file content';

      // Set up the mock to resolve with mockContent when called with encoding
      (fsPromises.readFile as jest.Mock).mockResolvedValueOnce(mockContent);

      const result = await fileSystem.readFile(mockPath, mockEncoding);

      expect(fsPromises.readFile).toHaveBeenCalledWith(mockPath, mockEncoding);
      expect(result).toBe(mockContent);
    });

    it('should read a file without encoding', async () => {
      const mockPath = 'mockPath';
      const mockContent = Buffer.from('file content');

      // Set up the mock to resolve with a Buffer when called without encoding
      (fsPromises.readFile as jest.Mock).mockResolvedValueOnce(mockContent);

      const result = await fileSystem.readFile(mockPath);

      expect(fsPromises.readFile).toHaveBeenCalledWith(mockPath, undefined);
      expect(result).toBe(mockContent);
    });

    it('should throw an error if file does not exist', async () => {
      const mockPath = 'nonExistentPath';
      const errorMessage = `ENOENT: no such file or directory, open '${mockPath}'`;

      // Set up the mock to reject with an error
      (fsPromises.readFile as jest.Mock).mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(fileSystem.readFile(mockPath)).rejects.toThrow(errorMessage);
      expect(fsPromises.readFile).toHaveBeenCalledWith(mockPath, undefined);
    });
  });

  describe('access', () => {
    it('should check file access with mode', async () => {
      const mockPath = 'mockPath';
      const mockMode = constants.F_OK;

      // Set up the mock to resolve successfully
      (fsPromises.access as jest.Mock).mockResolvedValueOnce(undefined);

      await fileSystem.access(mockPath, mockMode);

      expect(fsPromises.access).toHaveBeenCalledWith(mockPath, mockMode);
    });

    it('should check file access without mode', async () => {
      const mockPath = 'mockPath';

      // Set up the mock to resolve successfully
      (fsPromises.access as jest.Mock).mockResolvedValueOnce(undefined);

      await fileSystem.access(mockPath);

      expect(fsPromises.access).toHaveBeenCalledWith(mockPath, undefined);
    });

    it('should throw an error if access is denied', async () => {
      const mockPath = 'protectedPath';
      const errorMessage = `ENOENT: no such file or directory, access '${mockPath}'`;

      // Set up the mock to reject with an error
      (fsPromises.access as jest.Mock).mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(fileSystem.access(mockPath)).rejects.toThrow(errorMessage);
      expect(fsPromises.access).toHaveBeenCalledWith(mockPath, undefined);
    });
  });
});
