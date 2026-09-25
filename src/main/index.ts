import { BrowserWindow, app, ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
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
    title: 'Today — CreateMeter',
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

function wireIpc(instance: Tracker): void {
  ipcMain.handle('snapshot', () => instance.snapshot())
  ipcMain.handle('set-paused', (_event, paused: boolean) => {
    instance.setPaused(Boolean(paused))
    return instance.snapshot()
  })
  ipcMain.handle('open-rules', () => {
    ensureRulesFile(instance.snapshot().rulesPath)
    return shell.openPath(instance.snapshot().rulesPath)
  })
  ipcMain.handle('open-data', () => shell.openPath(instance.snapshot().dataDir))
  ipcMain.handle('open-accessibility', () => openPreferencePane(ACCESSIBILITY_URLS))
  ipcMain.handle('open-automation', () => openPreferencePane(AUTOMATION_URLS))
}

app.whenReady().then(() => {
  const dataDir = app.getPath('userData')
  const rulesPath = join(dataDir, 'rules.json')
  const statsPath = join(dataDir, 'stats.json')
  ensureRulesFile(rulesPath)

  const store = new StatsStore(statsPath)
  tracker = new Tracker(store, rulesPath, dataDir)
  wireIpc(tracker)

  const image = loadTrayImage(resourcesDir())
  tray = new TrayController(image, {
    togglePaused: () => tracker?.setPaused(!tracker.paused),
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
    quit: () => {
      tracker?.stop()
      app.quit()
    }
  })

  const refresh = (): void => {
    if (!tracker || !tray) return
    const snapshot = tracker.snapshot()
    tray.render(snapshot)
    todayWindow?.webContents.send('snapshot', snapshot)
  }

  tracker.on('change', refresh)
  stopWatching = watchRules(rulesPath, () => {
    tracker?.reloadRules()
  })
  tracker.start()
  refresh()

  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  const showWindow =
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
