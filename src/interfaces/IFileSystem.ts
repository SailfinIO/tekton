export interface IFileSystem {
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  readFile(path: string): Promise<Buffer>;
  access(path: string, mode?: number): Promise<void>;
}
