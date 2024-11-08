import { access as fsAccess, readFile as fsReadFile } from 'fs/promises';
import { IFileSystem } from '../interfaces/IFileSystem';

export class FileSystem implements IFileSystem {
  async readFile(path: string, encoding: BufferEncoding): Promise<string>;
  async readFile(path: string): Promise<Buffer>;
  async readFile(
    path: string,
    encoding?: BufferEncoding,
  ): Promise<string | Buffer> {
    return fsReadFile(path, encoding);
  }

  async access(path: string, mode?: number): Promise<void> {
    return fsAccess(path, mode);
  }
}
