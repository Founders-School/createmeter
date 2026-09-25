import { escapeAppleScript, runCommand } from './exec'
import type { FrontmostApp, PermissionState } from '../shared/types'

const SAFARI_URL = `
tell application "Safari"
  if (count of windows) is 0 then return ""
  return URL of current tab of front window
end tell
`.trim()

const CHROME_FAMILY_URL = (appName: string): string => `
tell application "${escapeAppleScript(appName)}"
  if (count of windows) is 0 then return ""
  return URL of active tab of front window
end tell
`.trim()

const FIREFOX_AX_URL = `
tell application "System Events"
  tell process "Firefox"
    set theUrl to ""
    try
      set theUrl to value of text field 1 of combo box 1 of toolbar 1 of front window
    end try
    if theUrl is "" then
      try
        set theUrl to value of UI element 1 of combo box 1 of toolbar 1 of front window
      end try
    end if
    return theUrl
  end tell
end tell
`.trim()

interface BrowserScript {
  names: string[]
  bundles: string[]
  script: string
}

const BROWSER_SCRIPTS: BrowserScript[] = [
  { names: ['safari'], bundles: ['com.apple.safari'], script: SAFARI_URL },
  { names: ['google chrome', 'chrome'], bundles: ['com.google.chrome'], script: CHROME_FAMILY_URL('Google Chrome') },
  { names: ['chromium'], bundles: ['org.chromium.chromium'], script: CHROME_FAMILY_URL('Chromium') },
  { names: ['arc'], bundles: ['company.thebrowser.browser'], script: CHROME_FAMILY_URL('Arc') },
  { names: ['brave browser', 'brave'], bundles: ['com.brave.browser'], script: CHROME_FAMILY_URL('Brave Browser') },
  { names: ['microsoft edge'], bundles: ['com.microsoft.edgemac'], script: CHROME_FAMILY_URL('Microsoft Edge') },
  { names: ['orion'], bundles: ['com.kagi.kagimacos'], script: CHROME_FAMILY_URL('Orion') },
  { names: ['vivaldi'], bundles: ['com.vivaldi.vivaldi'], script: CHROME_FAMILY_URL('Vivaldi') },
  { names: ['opera'], bundles: ['com.operasoftware.opera'], script: CHROME_FAMILY_URL('Opera') },
  { names: ['zen browser', 'zen'], bundles: ['app.zen-browser.zen'], script: CHROME_FAMILY_URL('Zen Browser') },
  { names: ['firefox'], bundles: ['org.mozilla.firefox'], script: FIREFOX_AX_URL }
]

function parseLsappinfoField(raw: string): string {
  const match = raw.match(/=\s*"([^"]*)"/) || raw.match(/=\s*([^;\n]+)/)
  return (match?.[1] ?? '').trim()
}

export async function getFrontmostApp(): Promise<FrontmostApp> {
  const front = await runCommand('/usr/bin/lsappinfo', ['front'])
  if (front.ok && front.stdout.trim()) {
    const asn = front.stdout.trim()
    const [nameResult, bundleResult] = await Promise.all([
      runCommand('/usr/bin/lsappinfo', ['info', '-only', 'name', asn]),
      runCommand('/usr/bin/lsappinfo', ['info', '-only', 'bundleid', asn])
    ])
    const name = parseLsappinfoField(nameResult.stdout)
    const bundleId = parseLsappinfoField(bundleResult.stdout)
    if (name || bundleId) return { name: name || bundleId, bundleId }
  }

  const fallback = await runCommand('/usr/bin/osascript', [
    '-e',
    'tell application "System Events" to get {name, bundle identifier} of first application process whose frontmost is true'
  ])
  if (fallback.ok) {
    const [name, bundleId] = fallback.stdout.split(',').map((part) => part.trim())
    if (name) return { name, bundleId: bundleId ?? '' }
  }

  throw new Error(fallback.stderr || 'Could not read the frontmost app')
}

function findBrowserScript(app: FrontmostApp): string | undefined {
  const name = app.name.toLowerCase()
  const bundle = app.bundleId.toLowerCase()
  const known = BROWSER_SCRIPTS.find(
    (entry) => entry.names.includes(name) || entry.bundles.includes(bundle)
  )
  if (known) return known.script
  return undefined
}

export async function getBrowserUrl(app: FrontmostApp): Promise<{ url?: string; error?: string }> {
  const script = findBrowserScript(app) ?? CHROME_FAMILY_URL(app.name)
  const result = await runCommand('/usr/bin/osascript', ['-e', script], 2500)
  if (!result.ok) {
    return { error: result.stderr || 'AppleScript failed' }
  }
  const url = result.stdout.trim().replace(/^"|"$/g, '')
  if (!url || url === 'missing value') return {}
  return { url }
}

export async function getIdleSeconds(): Promise<number> {
  const result = await runCommand('/usr/sbin/ioreg', ['-c', 'IOHIDSystem', '-d', '4'])
  const match = result.stdout.match(/"HIDIdleTime"\s*=\s*(\d+)/)
  if (!match) return 0
  return Number(match[1]) / 1_000_000_000
}

export async function isScreenLocked(): Promise<boolean> {
  const saver = await runCommand('/usr/bin/pgrep', ['-x', 'ScreenSaverEngine'])
  if (saver.ok && saver.stdout.trim()) return true

  const ioreg = await runCommand('/usr/sbin/ioreg', ['-n', 'Root', '-d1'])
  if (/CGSSessionScreenIsLocked"\s*=\s*Yes/i.test(ioreg.stdout)) return true

  const quartz = await runCommand('/usr/bin/python3', [
    '-c',
    'import Quartz; d=Quartz.CGSessionCopyCurrentDictionary() or {}; print("1" if d.get("CGSSessionScreenIsLocked") else "0")'
  ])
  return quartz.ok && quartz.stdout.trim() === '1'
}

export async function probeAccessibility(): Promise<PermissionState> {
  const result = await runCommand('/usr/bin/osascript', [
    '-e',
    'tell application "System Events" to get name of first process'
  ])
  if (result.ok && result.stdout.trim()) return 'granted'
  const text = `${result.stderr} ${result.stdout}`.toLowerCase()
  if (text.includes('assistive') || text.includes('not allowed') || text.includes('1002')) {
    return 'denied'
  }
  return 'unknown'
}

export async function probeAutomation(): Promise<PermissionState> {
  const result = await runCommand('/usr/bin/osascript', [
    '-e',
    'tell application "Safari" to get name'
  ])
  if (result.ok) return 'granted'
  const text = `${result.stderr} ${result.stdout}`.toLowerCase()
  if (text.includes('not allowed') || text.includes('oserror') || text.includes('-1743')) {
    return 'denied'
  }
  return 'unknown'
}

export const ACCESSIBILITY_URLS = [
  'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility',
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
]

export const AUTOMATION_URLS = [
  'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Automation',
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'
]
