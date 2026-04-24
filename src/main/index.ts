import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/DeployMe.png?asset'
import { googleAuthService } from './auth'
import { ApplicationDataSync } from './dataSync'

const CLOUD_DATA_FILE_NAME = 'deployme_data.json'
const LOCAL_DATA_FILE_NAME = 'vagas.json'

const dataSync = new ApplicationDataSync(
  join(app.getPath('userData'), LOCAL_DATA_FILE_NAME),
  CLOUD_DATA_FILE_NAME
)

let pendingSyncTimer: NodeJS.Timeout | null = null
let isClosingAfterSync = false

function parseApplications(rawData: string): unknown[] {
  try {
    const parsed = JSON.parse(rawData)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

ipcMain.handle('open-cv', async (_, filePath: string) => {
  if (!filePath) return

  const errorMessage = await shell.openPath(filePath)
  if (errorMessage) {
    throw new Error(errorMessage)
  }
})

ipcMain.handle('google-auth-login', async () => {
  try {
    const user = await googleAuthService.login()
    return { isAuthenticated: true, user }
  } catch (error) {
    console.error('[GoogleAuth] Login failed:', error)
    throw error
  }
})

ipcMain.handle('google-auth-status', async () => {
  try {
    const user = await googleAuthService.getCurrentUser()
    return { isAuthenticated: Boolean(user), user }
  } catch (error) {
    console.error('[GoogleAuth] Failed to load auth status:', error)
    return { isAuthenticated: false, user: null }
  }
})

ipcMain.handle('applications-load', async () => {
  try {
    const cloudData = await dataSync.pullFromCloud()
    const localData = cloudData ?? (await dataSync.readLocalData())
    return parseApplications(localData)
  } catch (error) {
    console.error('[DataSync] Failed to load applications:', error)
    return []
  }
})

ipcMain.handle('applications-save', async (_, applications: unknown) => {
  const serializedData = JSON.stringify(Array.isArray(applications) ? applications : [], null, 2)

  try {
    await dataSync.saveLocalData(serializedData)
  } catch (error) {
    console.error('[DataSync] Failed to save local applications:', error)
    throw error
  }

  if (pendingSyncTimer) {
    clearTimeout(pendingSyncTimer)
  }

  pendingSyncTimer = setTimeout(() => {
    dataSync.syncLocalToCloud().catch((error) => {
      console.error('[DataSync] Background cloud sync failed:', error)
    })
  }, 1500)
})

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', (event) => {
  if (isClosingAfterSync) {
    return
  }

  event.preventDefault()
  isClosingAfterSync = true

  if (pendingSyncTimer) {
    clearTimeout(pendingSyncTimer)
    pendingSyncTimer = null
  }

  dataSync
    .syncLocalToCloud()
    .catch((error) => {
      console.error('[DataSync] Final cloud sync failed:', error)
    })
    .finally(() => {
      app.quit()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
