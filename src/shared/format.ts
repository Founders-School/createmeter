import type { Category, DayTotals } from './types'

export function localDateKey(at = Date.now()): string {
  const d = new Date(at)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function emptyDay(date: string): DayTotals {
  return { date, creatingMs: 0, consumingMs: 0, neutralMs: 0 }
}

export function addMs(day: DayTotals, category: Category, ms: number): void {
  if (ms <= 0) return
  if (category === 'creating') day.creatingMs += ms
  else if (category === 'consuming') day.consumingMs += ms
  else day.neutralMs += ms
}

export function totalMs(day: DayTotals): number {
  return day.creatingMs + day.consumingMs + day.neutralMs
}

export function sumDays(days: DayTotals[], date = 'week'): DayTotals {
  const out = emptyDay(date)
  for (const day of days) {
    out.creatingMs += day.creatingMs
    out.consumingMs += day.consumingMs
    out.neutralMs += day.neutralMs
  }
  return out
}

export function formatDuration(ms: number, compact = false): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (compact) {
    if (hours > 0) return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`
    return `${minutes}m`
  }

  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

export function formatCompactTray(today: DayTotals, extra?: string): string {
  const create = formatDuration(today.creatingMs, true)
  const consume = formatDuration(today.consumingMs, true)
  const base = `C ${create} · V ${consume}`
  return extra ? `${base} · ${extra}` : base
}

export function creatingShare(day: DayTotals): number | null {
  const tracked = day.creatingMs + day.consumingMs
  if (tracked <= 0) return null
  return day.creatingMs / tracked
}

export function categoryLabel(category: Category): string {
  if (category === 'creating') return 'Creating'
  if (category === 'consuming') return 'Consuming'
  return 'Neutral'
}

export function weekdayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' })
}

export function longDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

export function parseUrl(raw?: string): { url?: string; host?: string; path?: string } {
  if (!raw) return {}
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '""' || trimmed === 'missing value') return {}

  try {
    const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
      ? trimmed
      : `https://${trimmed}`
    const url = new URL(withProtocol)
    if (url.protocol === 'file:') {
      return { url: trimmed, host: 'localhost', path: url.pathname }
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { url: trimmed }
    }
    return {
      url: trimmed,
      host: url.hostname.toLowerCase(),
      path: url.pathname || '/'
    }
  } catch {
    return { url: trimmed }
  }
}
