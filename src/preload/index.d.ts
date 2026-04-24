import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openCv: (filePath: string) => Promise<void>
    }
  }
}
