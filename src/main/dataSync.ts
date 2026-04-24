import Store from 'electron-store'
import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

import { googleAuthService } from './auth'
import { GoogleDriveStorage } from './driveStorage'

type DriveStore = {
  driveDataFileId?: string
}

/** Empty JSON array used for new local/cloud application data files. */
const DEFAULT_CONTENT = '[]'

export class ApplicationDataSync {
  private readonly localFilePath: string

  private readonly cloudFileName: string

  private readonly store = new Store<DriveStore>({ name: 'drive-store' })

  constructor(localFilePath: string, cloudFileName: string) {
    this.localFilePath = localFilePath
    this.cloudFileName = cloudFileName
  }

  private async ensureLocalFileExists(): Promise<void> {
    await fs.mkdir(dirname(this.localFilePath), { recursive: true })

    try {
      await fs.access(this.localFilePath)
    } catch {
      await fs.writeFile(this.localFilePath, DEFAULT_CONTENT, 'utf-8')
    }
  }

  async readLocalData(): Promise<string> {
    await this.ensureLocalFileExists()
    return fs.readFile(this.localFilePath, 'utf-8')
  }

  async saveLocalData(data: string): Promise<void> {
    await this.ensureLocalFileExists()
    await fs.writeFile(this.localFilePath, data, 'utf-8')
  }

  private async resolveDriveFileId(
    storage: GoogleDriveStorage,
    fallbackData: string
  ): Promise<string> {
    const existingStoredId = this.store.get('driveDataFileId')
    if (existingStoredId) {
      return existingStoredId
    }

    const existingId = await storage.findFileByName(this.cloudFileName)
    if (existingId) {
      this.store.set('driveDataFileId', existingId)
      return existingId
    }

    const createdId = await storage.createFile(this.cloudFileName, fallbackData)
    this.store.set('driveDataFileId', createdId)
    return createdId
  }

  async pullFromCloud(): Promise<string | null> {
    const authClient = await googleAuthService.getAuthorizedClient()
    if (!authClient) {
      return null
    }

    const localData = await this.readLocalData()
    const storage = new GoogleDriveStorage(authClient)
    const fileId = await this.resolveDriveFileId(storage, localData)
    const cloudData = await storage.readFile(fileId)

    await this.saveLocalData(cloudData)
    return cloudData
  }

  async syncLocalToCloud(): Promise<void> {
    const authClient = await googleAuthService.getAuthorizedClient()
    if (!authClient) {
      return
    }

    const localData = await this.readLocalData()
    const storage = new GoogleDriveStorage(authClient)
    const fileId = await this.resolveDriveFileId(storage, localData)

    await storage.saveFile(fileId, localData)
  }
}
