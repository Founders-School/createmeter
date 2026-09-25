import { Menu, Tray, nativeImage, type NativeImage } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { allowedEmailHint } from '../shared/auth'
import { categoryLabel, formatCompactTray, formatDuration, totalMs } from '../shared/format'
import type { Snapshot } from '../shared/types'

export interface TrayActions {
  togglePaused: () => void
  openToday: () => void
  openRules: () => void
  openData: () => void
  openAccessibility: () => void
  openAutomation: () => void
  signOut: () => void
  quit: () => void
}

export function loadTrayImage(resourcesDir: string): NativeImage {
  const template = join(resourcesDir, 'trayTemplate.png')
  const fallback = join(resourcesDir, 'icon.png')
  const path = existsSync(template) ? template : fallback
  const image = nativeImage.createFromPath(path)
  image.setTemplateImage(true)
  return image.isEmpty() ? nativeImage.createEmpty() : image
}

export class TrayController {
  private readonly tray: Tray

  constructor(
    image: NativeImage,
    private readonly actions: TrayActions
  ) {
    this.tray = new Tray(image)
    this.tray.setToolTip('CreateMeter')
  }

  render(snapshot: Snapshot): void {
    if (!snapshot.signedIn) {
      this.tray.setTitle('')
      this.tray.setToolTip('CreateMeter — Sign in')
      this.tray.setContextMenu(this.signedOutMenu())
      return
    }
    const extra = snapshot.paused ? 'paused' : snapshot.current?.locked ? 'locked' : snapshot.current?.idle ? 'idle' : undefined
    this.tray.setTitle(formatCompactTray(snapshot.today, extra))
    this.tray.setToolTip(this.tooltip(snapshot))
    this.tray.setContextMenu(this.menu(snapshot))
  }

  private signedOutMenu(): Electron.Menu {
    return Menu.buildFromTemplate([
      { label: 'CreateMeter', enabled: false },
      { type: 'separator' },
      { label: 'Signed out — tracking is off', enabled: false },
      { label: `Use ${allowedEmailHint()}`, enabled: false },
      { label: 'Sign in…', click: () => this.actions.openToday() },
      { type: 'separator' },
      { label: 'Quit CreateMeter', click: () => this.actions.quit() }
    ])
  }

  private tooltip(snapshot: Snapshot): string {
    const now = snapshot.current
    const who = snapshot.user?.email ? ` · ${snapshot.user.email}` : ''
    if (!now) return `CreateMeter${who}`
    const site = now.host ? ` · ${now.host}` : ''
    return `${now.appName}${site} · ${categoryLabel(now.category)}${who}`
  }

  private menu(snapshot: Snapshot): Electron.Menu {
    const current = snapshot.current
    const nowLine = this.nowLine(snapshot)
    const permissionItems = this.permissionItems(snapshot)
    const email = snapshot.user?.email ?? 'signed in'

    return Menu.buildFromTemplate([
      { label: 'CreateMeter', enabled: false },
      { label: `Signed in as ${email}`, enabled: false },
      { type: 'separator' },
      { label: 'Today', enabled: false },
      { label: `  Creating      ${formatDuration(snapshot.today.creatingMs)}`, enabled: false },
      { label: `  Consuming   ${formatDuration(snapshot.today.consumingMs)}`, enabled: false },
      { label: `  Neutral        ${formatDuration(snapshot.today.neutralMs)}`, enabled: false },
      {
        label:
          totalMs(snapshot.weekTotals) > 0
            ? `This week      C ${formatDuration(snapshot.weekTotals.creatingMs)} · V ${formatDuration(snapshot.weekTotals.consumingMs)}`
            : 'This week      no tracked time yet',
        enabled: false
      },
      { type: 'separator' },
      { label: 'Now', enabled: false },
      { label: `  ${nowLine}`, enabled: false },
      current?.reason ? { label: `  ${current.reason}`, enabled: false } : { visible: false },
      { type: 'separator' },
      {
        label: 'Pause tracking',
        type: 'checkbox',
        checked: snapshot.paused,
        click: () => this.actions.togglePaused()
      },
      { label: 'Open Today…', click: () => this.actions.openToday() },
      { label: 'Open rules…', click: () => this.actions.openRules() },
      { label: 'Reveal data folder…', click: () => this.actions.openData() },
      ...permissionItems,
      { type: 'separator' },
      { label: 'Sign out', click: () => this.actions.signOut() },
      { label: 'Quit CreateMeter', click: () => this.actions.quit() }
    ])
  }

  private nowLine(snapshot: Snapshot): string {
    const current = snapshot.current
    if (snapshot.paused) return 'Paused — time is not counting'
    if (!current) return 'Waiting for first sample…'
    if (current.locked) return 'Mac locked — not counted'
    if (current.idle) return `Idle · ${current.appName} — not counted`
    const host = current.host ? ` · ${current.host}` : ''
    return `${current.appName}${host} · ${categoryLabel(current.category).toLowerCase()}`
  }

  private permissionItems(snapshot: Snapshot): Electron.MenuItemConstructorOptions[] {
    if (!snapshot.isMac) {
      return [{ label: 'Live tracking requires macOS', enabled: false }]
    }
    const items: Electron.MenuItemConstructorOptions[] = []
    if (snapshot.permissions.accessibility !== 'granted') {
      items.push({
        label: 'Grant Accessibility…',
        click: () => this.actions.openAccessibility()
      })
    }
    if (snapshot.permissions.automation !== 'granted') {
      items.push({
        label: 'Grant Automation…',
        click: () => this.actions.openAutomation()
      })
    }
    return items
  }
}
