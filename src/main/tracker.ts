import { EventEmitter } from 'node:events'
import { classify } from '../shared/classifier'
import { parseUrl } from '../shared/format'
import type { PermissionsStatus, Rules, Sample, Snapshot } from '../shared/types'
import {
  getBrowserUrl,
  getFrontmostApp,
  getIdleSeconds,
  isScreenLocked,
  probeAccessibility,
  probeAutomation
} from './macos'
import { loadRules } from './rules'
import { simulatedWorld } from '../shared/simulator'
import { StatsStore } from './store'

const SLEEP_GAP_MS = 10_000

export class Tracker extends EventEmitter {
  paused = false
  current: Sample | null = null
  rules: Rules
  permissions: PermissionsStatus = {
    accessibility: process.platform === 'darwin' ? 'unknown' : 'unsupported',
    automation: process.platform === 'darwin' ? 'unknown' : 'unsupported'
  }

  private timer: NodeJS.Timeout | undefined
  private lastTick = Date.now()
  private permissionProbeAt = 0

  constructor(
    private readonly store: StatsStore,
    private readonly rulesPath: string,
    private readonly dataDir: string
  ) {
    super()
    this.rules = loadRules(rulesPath)
  }

  reloadRules(): void {
    this.rules = loadRules(this.rulesPath)
    this.emit('change')
  }

  start(): void {
    this.lastTick = Date.now()
    void this.tick()
    this.arm()
  }

  stop(): void {
    clearInterval(this.timer)
    this.timer = undefined
    this.store.flush()
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    if (this.current) this.current = { ...this.current, paused, counted: false }
    this.emit('change')
  }

  snapshot(): Snapshot {
    const today = this.store.today()
    const week = this.store.week()
    const tracking = Boolean(
      this.current && this.current.counted && !this.paused && !this.current.idle && !this.current.locked
    )
    return {
      today,
      week,
      weekTotals: this.store.weekTotals(),
      current: this.current,
      paused: this.paused,
      tracking,
      platform: process.platform,
      isMac: process.platform === 'darwin',
      permissions: this.permissions,
      dataDir: this.dataDir,
      rulesPath: this.rulesPath,
      idleThresholdSeconds: this.rules.idleThresholdSeconds,
      preview: false,
      signedIn: false,
      user: null,
      authConfigured: false,
      authMessage: ''
    }
  }

  private arm(): void {
    clearInterval(this.timer)
    this.timer = setInterval(() => {
      void this.tick()
    }, this.rules.pollIntervalMs)
  }

  private async tick(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastTick
    this.lastTick = now

    await this.refreshPermissions(now)

    try {
      this.current = await this.sample(now)
    } catch (error) {
      this.current = {
        at: now,
        appName: process.platform === 'darwin' ? 'Unknown' : 'Preview',
        bundleId: '',
        category: 'neutral',
        reason: error instanceof Error ? error.message : 'sample failed',
        idle: false,
        locked: false,
        paused: this.paused,
        counted: false
      }
    }

    const countable =
      !this.paused &&
      !this.current.idle &&
      !this.current.locked &&
      elapsed > 0 &&
      elapsed < SLEEP_GAP_MS

    if (countable) {
      this.store.add(this.current.category, elapsed, now)
      this.current.counted = true
    }

    this.emit('change')
  }

  private async sample(at: number): Promise<Sample> {
    const world =
      process.platform === 'darwin'
        ? await this.liveWorld()
        : (() => {
            const simulated = simulatedWorld(at)
            return {
              app: simulated.app,
              url: simulated.url,
              idle: simulated.idle,
              locked: simulated.locked,
              automationError: undefined as string | undefined
            }
          })()

    const parsed = parseUrl(world.url)
    const classified = classify(
      {
        name: world.app.name,
        bundleId: world.app.bundleId,
        host: parsed.host,
        path: parsed.path
      },
      this.rules
    )

    return {
      at,
      appName: world.app.name,
      bundleId: world.app.bundleId,
      url: parsed.url,
      host: parsed.host,
      path: parsed.path,
      category: classified.category,
      reason: world.automationError && classified.browser ? 'browser url unavailable' : classified.reason,
      idle: world.idle,
      locked: world.locked,
      paused: this.paused,
      counted: false
    }
  }

  private async liveWorld() {
    const [app, idleSeconds, locked] = await Promise.all([
      getFrontmostApp(),
      getIdleSeconds(),
      isScreenLocked()
    ])
    const idle = idleSeconds >= this.rules.idleThresholdSeconds
    let url: string | undefined
    let automationError: string | undefined

    const browser = classify({ name: app.name, bundleId: app.bundleId }, this.rules).browser
    if (browser) {
      const result = await getBrowserUrl(app)
      url = result.url
      automationError = result.error
      if (result.error) this.permissions.automation = 'denied'
      else if (result.url) this.permissions.automation = 'granted'
    }

    return { app, url, idle, locked, automationError }
  }

  private async refreshPermissions(now: number): Promise<void> {
    if (process.platform !== 'darwin') return
    if (now - this.permissionProbeAt < 15_000) return
    this.permissionProbeAt = now
    const [accessibility, automation] = await Promise.all([probeAccessibility(), probeAutomation()])
    this.permissions = { accessibility, automation }
  }
}
