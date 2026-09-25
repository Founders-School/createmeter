import { describe, expect, it } from 'vitest'
import { classify, hostMatches, identifierMatches, isBrowser } from './classifier'
import { DEFAULT_RULES } from './default-rules'
import { formatCompactTray, formatDuration, parseUrl } from './format'

const cursor = { name: 'Cursor', bundleId: 'com.todesktop.230313mzl4w4u92' }
const safari = { name: 'Safari', bundleId: 'com.apple.Safari' }
const chrome = { name: 'Google Chrome', bundleId: 'com.google.Chrome' }
const slack = { name: 'Slack', bundleId: 'com.tinyspeck.slackmacgap' }
const mail = { name: 'Mail', bundleId: 'com.apple.mail' }
const finder = { name: 'Finder', bundleId: 'com.apple.finder' }
const archive = { name: 'Archive Utility', bundleId: 'com.apple.archiveutility' }

describe('identifierMatches', () => {
  it('matches Cursor by name and avoids Archive Utility for Arc', () => {
    expect(identifierMatches(cursor.name, cursor.bundleId, 'Cursor')).toBe(true)
    expect(identifierMatches(archive.name, archive.bundleId, 'Arc')).toBe(false)
    expect(identifierMatches('Arc', 'company.thebrowser.Browser', 'Arc')).toBe(true)
  })

  it('matches Visual Studio Code with a short Code token', () => {
    expect(identifierMatches('Visual Studio Code', 'com.microsoft.VSCode', 'Code')).toBe(true)
  })
})

describe('classify defaults', () => {
  it('treats coding and writing apps as creating', () => {
    expect(classify(cursor, DEFAULT_RULES).category).toBe('creating')
    expect(classify({ name: 'iTerm2', bundleId: 'com.googlecode.iterm2' }, DEFAULT_RULES).category).toBe(
      'creating'
    )
    expect(classify({ name: 'Notion', bundleId: 'notion.id' }, DEFAULT_RULES).category).toBe('creating')
    expect(classify({ name: 'Xcode', bundleId: 'com.apple.dt.Xcode' }, DEFAULT_RULES).category).toBe(
      'creating'
    )
  })

  it('treats chat and Mail as neutral', () => {
    expect(classify(slack, DEFAULT_RULES)).toMatchObject({ category: 'neutral' })
    expect(classify(mail, DEFAULT_RULES)).toMatchObject({ category: 'neutral' })
    expect(classify(finder, DEFAULT_RULES)).toMatchObject({ category: 'neutral' })
  })

  it('classifies browsers by hostname', () => {
    expect(
      classify({ ...safari, host: 'www.youtube.com', path: '/watch' }, DEFAULT_RULES).category
    ).toBe('consuming')
    expect(classify({ ...chrome, host: 'github.com', path: '/cursor' }, DEFAULT_RULES).category).toBe(
      'creating'
    )
    expect(classify({ ...chrome, host: 'docs.google.com', path: '/document' }, DEFAULT_RULES).category).toBe(
      'creating'
    )
    expect(classify({ ...safari, host: 'example.com', path: '/' }, DEFAULT_RULES).category).toBe(
      'consuming'
    )
    expect(classify({ ...safari, host: 'localhost', path: '/app' }, DEFAULT_RULES).category).toBe(
      'creating'
    )
    expect(
      classify({ ...chrome, host: 'preview-abc.vercel.app', path: '/' }, DEFAULT_RULES).category
    ).toBe('creating')
  })

  it('uses the browser default when the URL is missing', () => {
    const result = classify(safari, DEFAULT_RULES)
    expect(result.browser).toBe(true)
    expect(result.category).toBe('consuming')
  })

  it('uses unknown-app default for unmatched apps', () => {
    expect(classify({ name: 'Mystery.app', bundleId: 'com.example.mystery' }, DEFAULT_RULES).category).toBe(
      'neutral'
    )
  })

  it('prefers a more specific host rule', () => {
    const rules = {
      ...DEFAULT_RULES,
      hosts: [
        { host: 'google.com', category: 'consuming' as const },
        { host: 'docs.google.com', category: 'creating' as const }
      ]
    }
    expect(classify({ ...chrome, host: 'docs.google.com', path: '/' }, rules).category).toBe('creating')
  })
})

describe('host matching', () => {
  it('matches suffixes and ignores www', () => {
    expect(hostMatches('www.youtube.com', 'youtube.com')).toBe(true)
    expect(hostMatches('music.youtube.com', 'youtube.com')).toBe(true)
    expect(hostMatches('notyoutube.com', 'youtube.com')).toBe(false)
  })
})

describe('isBrowser', () => {
  it('detects common browsers without matching unrelated apps', () => {
    expect(isBrowser(safari, DEFAULT_RULES)).toBe(true)
    expect(isBrowser(chrome, DEFAULT_RULES)).toBe(true)
    expect(isBrowser(cursor, DEFAULT_RULES)).toBe(false)
  })
})

describe('format helpers', () => {
  it('formats durations for the tray and menu', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(42_000)).toBe('42s')
    expect(formatDuration(12 * 60_000)).toBe('12m')
    expect(formatDuration((1 * 3600 + 12 * 60) * 1000)).toBe('1h 12m')
    expect(formatDuration((1 * 3600 + 12 * 60) * 1000, true)).toBe('1h12m')
    expect(
      formatCompactTray({ date: '2026-09-25', creatingMs: 4_320_000, consumingMs: 2_520_000, neutralMs: 0 })
    ).toBe('C 1h12m · V 42m')
  })

  it('parses browser URLs', () => {
    expect(parseUrl('https://www.youtube.com/watch?v=1')).toMatchObject({
      host: 'www.youtube.com',
      path: '/watch'
    })
    expect(parseUrl('github.com/foo')).toMatchObject({ host: 'github.com', path: '/foo' })
    expect(parseUrl('missing value')).toEqual({})
  })
})
