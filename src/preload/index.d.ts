import { ElectronAPI } from '@electron-toolkit/preload'

type GoogleAuthUser = {
  name: string
  email: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openCv: (filePath: string) => Promise<void>
      loginWithGoogle: () => Promise<{ isAuthenticated: boolean; user: GoogleAuthUser | null }>
      getGoogleAuthStatus: () => Promise<{ isAuthenticated: boolean; user: GoogleAuthUser | null }>
      getVagas: () => Promise<unknown[]>
      saveVagas: (applications: unknown[]) => Promise<void>
      loadApplications: () => Promise<unknown[]>
      saveApplications: (applications: unknown[]) => Promise<void>
    }
  }
}
