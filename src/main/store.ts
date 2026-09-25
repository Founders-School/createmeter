import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { addMs, emptyDay, localDateKey, sumDays } from '../shared/format'
import type { Category, DayTotals } from '../shared/types'

interface StoreFile {
  days: Record<string, DayTotals>
}

const RETAIN_DAYS = 90

export class StatsStore {
  private days = new Map<string, DayTotals>()
  private writeTimer: NodeJS.Timeout | undefined

  constructor(private readonly filePath: string) {
    this.load()
  }

  private load(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    if (!existsSync(this.filePath)) return
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as StoreFile
      for (const [date, day] of Object.entries(parsed.days ?? {})) {
        this.days.set(date, {
          date,
          creatingMs: Number(day.creatingMs) || 0,
          consumingMs: Number(day.consumingMs) || 0,
          neutralMs: Number(day.neutralMs) || 0
        })
      }
    } catch (error) {
      console.warn('CreateMeter: could not read stats file', error)
    }
  }

  private persistSoon(): void {
    clearTimeout(this.writeTimer)
    this.writeTimer = setTimeout(() => this.flush(), 400)
  }

  flush(): void {
    const days: Record<string, DayTotals> = {}
    for (const [date, day] of this.days) days[date] = day
    writeFileSync(this.filePath, JSON.stringify({ days }, null, 2) + '\n', 'utf8')
  }

  add(category: Category, ms: number, at = Date.now()): DayTotals {
    const date = localDateKey(at)
    const day = this.days.get(date) ?? emptyDay(date)
    addMs(day, category, ms)
    this.days.set(date, day)
    this.prune()
    this.persistSoon()
    return { ...day }
  }

  today(at = Date.now()): DayTotals {
    const date = localDateKey(at)
    return { ...(this.days.get(date) ?? emptyDay(date)) }
  }

  week(at = Date.now()): DayTotals[] {
    const days: DayTotals[] = []
    const start = new Date(at)
    start.setHours(12, 0, 0, 0)
    for (let i = 6; i >= 0; i -= 1) {
      const cursor = new Date(start)
      cursor.setDate(start.getDate() - i)
      const date = localDateKey(cursor.getTime())
      days.push({ ...(this.days.get(date) ?? emptyDay(date)) })
    }
    return days
  }

  weekTotals(at = Date.now()): DayTotals {
    return sumDays(this.week(at), 'week')
  }

  private prune(at = Date.now()): void {
    const cutoff = new Date(at)
    cutoff.setDate(cutoff.getDate() - RETAIN_DAYS)
    const min = localDateKey(cutoff.getTime())
    for (const date of this.days.keys()) {
      if (date < min) this.days.delete(date)
    }
  }
}
