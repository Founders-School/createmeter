import type { AppRule, Category, FrontmostApp, HostRule, Rules } from './types'

export interface ClassifyInput extends FrontmostApp {
  host?: string
  path?: string
}

export interface ClassifyResult {
  category: Category
  reason: string
  browser: boolean
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function identifierMatches(appName: string, bundleId: string, pattern: string): boolean {
  const p = pattern.trim().toLowerCase()
  if (!p) return false
  const name = appName.trim().toLowerCase()
  const bid = bundleId.trim().toLowerCase()

  if (name === p || bid === p) return true
  if (p.includes('.') && (bid === p || bid.includes(p))) return true

  if (p.length <= 4) {
    const word = new RegExp(`(?:^|[\\s._-])${escapeRegExp(p)}(?:$|[\\s._-])`, 'i')
    return word.test(name) || bid.split('.').includes(p)
  }

  return name.includes(p) || bid.includes(p)
}

export function isBrowser(app: FrontmostApp, rules: Rules): boolean {
  return rules.browsers.some((pattern) => identifierMatches(app.name, app.bundleId, pattern))
}

export function matchAppRule(app: FrontmostApp, rules: AppRule[]): AppRule | undefined {
  return rules.find((rule) => identifierMatches(app.name, app.bundleId, rule.match))
}

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
}

export function hostMatches(hostname: string, pattern: string): boolean {
  const host = normalizeHost(hostname)
  const rule = normalizeHost(pattern)
  if (!host || !rule) return false
  return host === rule || host.endsWith(`.${rule}`)
}

export function matchHostRule(host: string | undefined, path: string | undefined, rules: HostRule[]): HostRule | undefined {
  if (!host) return undefined
  const pathname = path || '/'
  const matches = rules.filter((rule) => {
    if (!hostMatches(host, rule.host)) return false
    if (!rule.pathPrefix) return true
    return pathname.startsWith(rule.pathPrefix)
  })
  matches.sort((a, b) => {
    const hostDelta = normalizeHost(b.host).length - normalizeHost(a.host).length
    if (hostDelta !== 0) return hostDelta
    return (b.pathPrefix?.length ?? 0) - (a.pathPrefix?.length ?? 0)
  })
  return matches[0]
}

export function classify(input: ClassifyInput, rules: Rules): ClassifyResult {
  const browser = isBrowser(input, rules)

  if (browser && input.host) {
    const hostRule = matchHostRule(input.host, input.path, rules.hosts)
    if (hostRule) {
      const suffix = hostRule.pathPrefix ? hostRule.pathPrefix : hostRule.host
      return { category: hostRule.category, reason: `host ${suffix}`, browser }
    }
    return {
      category: rules.defaults.unknownBrowserHost,
      reason: 'unknown browser host',
      browser
    }
  }

  const appRule = matchAppRule(input, rules.apps)
  if (appRule) {
    return { category: appRule.category, reason: `app ${appRule.match}`, browser }
  }

  if (browser) {
    return {
      category: rules.defaults.unknownBrowserHost,
      reason: input.host ? 'unknown browser host' : 'browser without url',
      browser
    }
  }

  return {
    category: rules.defaults.unknownApp,
    reason: 'unknown app',
    browser
  }
}
