import { google, drive_v3 } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'

import type { CloudStorage } from './cloudStorage'

export class GoogleDriveStorage implements CloudStorage {
  private readonly drive: drive_v3.Drive

  constructor(authClient: OAuth2Client) {
    this.drive = google.drive({ version: 'v3', auth: authClient })
  }

  async readFile(fileId: string): Promise<string> {
    const response = await this.drive.files.get({ fileId, alt: 'media' }, { responseType: 'json' })

    if (typeof response.data === 'string') {
      return response.data
    }

    if (Buffer.isBuffer(response.data)) {
      return response.data.toString('utf-8')
    }

    return JSON.stringify(response.data ?? [])
  }

  async saveFile(fileId: string, data: string): Promise<void> {
    await this.drive.files.update({
      fileId,
      media: {
        mimeType: 'application/json',
        body: data
      }
    })
  }

  async findFileByName(fileName: string): Promise<string | null> {
    const response = await this.drive.files.list({
      q: `name='${fileName.replace(/'/g, "\\'")}' and trashed=false and 'root' in parents`,
      fields: 'files(id, name)',
      pageSize: 1,
      spaces: 'drive'
    })

    return response.data.files?.[0]?.id ?? null
  }

  async createFile(fileName: string, data: string): Promise<string> {
    const response = await this.drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'application/json',
        parents: ['root']
      },
      media: {
        mimeType: 'application/json',
        body: data
      },
      fields: 'id'
    })

    if (!response.data.id) {
      throw new Error('Failed to create Google Drive data file.')
    }

    return response.data.id
  }
}
