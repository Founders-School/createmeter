import { BrowserWindow, app, ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { AuthGate } from './auth-gate'
import { ACCESSIBILITY_URLS, AUTOMATION_URLS } from './macos'
import { ensureRulesFile, watchRules } from './rules'
import { StatsStore } from './store'
import { Tracker } from './tracker'
import { TrayController, loadTrayImage } from './tray'

app.setName('CreateMeter')

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

let tracker: Tracker | undefined
let tray: TrayController | undefined
let todayWindow: BrowserWindow | null = null
let stopWatching: (() => void) | undefined
const auth = new AuthGate()
let dataDir = ''
let rulesPath = ''

function resourcesDir(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'resources')
  return join(app.getAppPath(), 'resources')
}

function preloadScript(): string {
  const dir = join(import.meta.dirname, '../preload')
  for (const name of ['index.js', 'index.mjs', 'index.cjs']) {
    const candidate = join(dir, name)
    if (existsSync(candidate)) return candidate
  }
  return join(dir, 'index.js')
}

function currentSnapshot() {
  if (!tracker) throw new Error('CreateMeter is still starting.')
  return auth.decorate(tracker.snapshot())
}

function refresh(): void {
  if (!tracker || !tray) return
  const snapshot = currentSnapshot()
  tray.render(snapshot)
  todayWindow?.webContents.send('snapshot', snapshot)
}

function startTracking(): void {
  if (!tracker) return
  tracker.start()
  refresh()
}

function stopTracking(): void {
  tracker?.stop()
  refresh()
}

function createTodayWindow(): void {
  if (todayWindow && !todayWindow.isDestroyed()) {
    todayWindow.show()
    todayWindow.focus()
    return
  }

  todayWindow = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 360,
    minHeight: 560,
    title: auth.signedIn ? 'Today — CreateMeter' : 'Sign in — CreateMeter',
    autoHideMenuBar: true,
    backgroundColor: '#f4efe6',
    webPreferences: {
      preload: preloadScript(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  todayWindow.on('closed', () => {
    todayWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void todayWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void todayWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

async function openPreferencePane(urls: string[]): Promise<void> {
  for (const url of urls) {
    try {
      await shell.openExternal(url)
      return
    } catch {
      // Sequoia and older macOS use different preference URLs.
    }
  }
}

async function handleSignIn(): Promise<ReturnType<typeof currentSnapshot>> {
  createTodayWindow()
  try {
    await auth.signIn(dataDir)
    startTracking()
  } catch (error) {
    refresh()
    throw error
  }
  return currentSnapshot()
}

function handleSignOut(): ReturnType<typeof currentSnapshot> {
  stopTracking()
  auth.signOut(dataDir)
  createTodayWindow()
  refresh()
  return currentSnapshot()
}

function wireIpc(): void {
  ipcMain.handle('snapshot', () => currentSnapshot())
  ipcMain.handle('set-paused', (_event, paused: boolean) => {
    if (!auth.signedIn) return currentSnapshot()
    tracker?.setPaused(Boolean(paused))
    return currentSnapshot()
  })
  ipcMain.handle('open-rules', () => {
    ensureRulesFile(currentSnapshot().rulesPath)
    return shell.openPath(currentSnapshot().rulesPath)
  })
  ipcMain.handle('open-data', () => shell.openPath(currentSnapshot().dataDir))
  ipcMain.handle('open-accessibility', () => openPreferencePane(ACCESSIBILITY_URLS))
  ipcMain.handle('open-automation', () => openPreferencePane(AUTOMATION_URLS))
  ipcMain.handle('sign-in', () => handleSignIn())
  ipcMain.handle('sign-out', () => handleSignOut())
}

app.whenReady().then(async () => {
  dataDir = app.getPath('userData')
  rulesPath = join(dataDir, 'rules.json')
  const statsPath = join(dataDir, 'stats.json')
  ensureRulesFile(rulesPath)

  const store = new StatsStore(statsPath)
  tracker = new Tracker(store, rulesPath, dataDir)
  wireIpc()

  const image = loadTrayImage(resourcesDir())
  tray = new TrayController(image, {
    togglePaused: () => {
      if (!auth.signedIn || !tracker) return
      tracker.setPaused(!tracker.paused)
    },
    openToday: () => createTodayWindow(),
    openRules: () => {
      ensureRulesFile(rulesPath)
      void shell.openPath(rulesPath)
    },
    openData: () => {
      void shell.openPath(dataDir)
    },
    openAccessibility: () => {
      void openPreferencePane(ACCESSIBILITY_URLS)
    },
    openAutomation: () => {
      void openPreferencePane(AUTOMATION_URLS)
    },
    signIn: () => {
      void handleSignIn().catch((error) => {
        console.warn('CreateMeter: sign-in failed', error)
      })
    },
    signOut: () => {
      handleSignOut()
    },
    quit: () => {
      tracker?.stop()
      app.quit()
    }
  })

  tracker.on('change', refresh)
  stopWatching = watchRules(rulesPath, () => {
    tracker?.reloadRules()
  })

  const signedIn = await auth.restore(dataDir)
  if (signedIn) startTracking()
  else refresh()

  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  const showWindow =
    !signedIn ||
    process.platform !== 'darwin' ||
    !app.isPackaged ||
    process.env.CREATEMETER_WINDOW === '1'
  if (showWindow) createTodayWindow()
})

app.on('second-instance', () => {
  createTodayWindow()
})

app.on('window-all-closed', () => {
  // Stay alive as a menu-bar extra.
})

app.on('before-quit', () => {
  stopWatching?.()
  tracker?.stop()
})

app.on('activate', () => {
  createTodayWindow()
})
