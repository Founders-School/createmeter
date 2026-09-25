import { classify } from '../shared/classifier'
import { DEFAULT_RULES } from '../shared/default-rules'
import { addMs, emptyDay, localDateKey, parseUrl, sumDays } from '../shared/format'
import type { DayTotals, Sample, Snapshot } from '../shared/types'
import { simulatedWorld } from '../shared/simulator'

function sampleFromWorld(at: number): Sample {
  const world = simulatedWorld(at)
  const parsed = parseUrl(world.url)
  const classified = classify(
    {
      name: world.app.name,
      bundleId: world.app.bundleId,
      host: parsed.host,
      path: parsed.path
    },
    DEFAULT_RULES
  )
  return {
    at,
    appName: world.app.name,
    bundleId: world.app.bundleId,
    url: parsed.url,
    host: parsed.host,
    path: parsed.path,
    category: classified.category,
    reason: world.idle ? 'idle — not counted' : classified.reason,
    idle: world.idle,
    locked: world.locked,
    paused: false,
    counted: !world.idle && !world.locked
  }
}

function seedWeek(now: number): DayTotals[] {
  const days: DayTotals[] = []
  const start = new Date(now)
  start.setHours(12, 0, 0, 0)
  for (let i = 6; i >= 0; i -= 1) {
    const cursor = new Date(start)
    cursor.setDate(start.getDate() - i)
    const date = localDateKey(cursor.getTime())
    const day = emptyDay(date)
    if (i === 0) {
      days.push(day)
      continue
    }
    addMs(day, 'creating', (2 + ((i * 17) % 4)) * 3600_000)
    addMs(day, 'consuming', (1 + (i % 3)) * 3600_000)
    addMs(day, 'neutral', 20 * 60_000 + i * 5 * 60_000)
    days.push(day)
  }
  return days
}

export function createPreviewStore() {
  const now = Date.now()
  const week = seedWeek(now)
  const today = week[week.length - 1]
  addMs(today, 'creating', 48 * 60_000)
  addMs(today, 'consuming', 19 * 60_000)
  addMs(today, 'neutral', 8 * 60_000)
  let paused = false
  let lastTick = now
  let current = sampleFromWorld(now)

  return {
    tick(at = Date.now()): Snapshot {
      const elapsed = Math.min(at - lastTick, 2000)
      lastTick = at
      current = { ...sampleFromWorld(at), paused }
      if (!paused && current.counted) addMs(today, current.category, elapsed)
      return {
        today: { ...today },
        week: week.map((day) => ({ ...day })),
        weekTotals: sumDays(week, 'week'),
        current,
        paused,
        tracking: !paused && current.counted,
        platform: 'preview',
        isMac: false,
        permissions: { accessibility: 'unsupported', automation: 'unsupported' },
        dataDir: '~/Library/Application Support/CreateMeter',
        rulesPath: '~/Library/Application Support/CreateMeter/rules.json',
        idleThresholdSeconds: DEFAULT_RULES.idleThresholdSeconds,
        preview: true
      }
    },
    setPaused(next: boolean): Snapshot {
      paused = next
      return this.tick()
    }
  }
}
