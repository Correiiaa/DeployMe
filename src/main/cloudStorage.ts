export interface CloudStorage {
  readFile(fileId: string): Promise<string>
  saveFile(fileId: string, data: string): Promise<void>
}
