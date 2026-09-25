import { copyFileSync, existsSync, mkdirSync, readFileSync, watch, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_RULES } from '../shared/default-rules'
import type { Rules } from '../shared/types'

const bundledRules = (): string =>
  JSON.stringify({ ...DEFAULT_RULES, notes: DEFAULT_RULES.notes }, null, 2) + '\n'

export function bundledDefaultRulesPath(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  return join(here, '../../resources/default-rules.json')
}

export function ensureRulesFile(rulesPath: string): void {
  mkdirSync(dirname(rulesPath), { recursive: true })
  if (existsSync(rulesPath)) return
  const bundled = bundledDefaultRulesPath()
  if (existsSync(bundled)) {
    copyFileSync(bundled, rulesPath)
    return
  }
  writeFileSync(rulesPath, bundledRules(), 'utf8')
}

export function loadRules(rulesPath: string): Rules {
  ensureRulesFile(rulesPath)
  try {
    const parsed = JSON.parse(readFileSync(rulesPath, 'utf8')) as Partial<Rules>
    return mergeRules(parsed)
  } catch (error) {
    console.warn('CreateMeter: invalid rules file, using defaults', error)
    return { ...DEFAULT_RULES }
  }
}

export function mergeRules(partial: Partial<Rules>): Rules {
  return {
    ...DEFAULT_RULES,
    ...partial,
    version: 1,
    browsers: partial.browsers?.length ? partial.browsers : DEFAULT_RULES.browsers,
    apps: partial.apps?.length ? partial.apps : DEFAULT_RULES.apps,
    hosts: partial.hosts?.length ? partial.hosts : DEFAULT_RULES.hosts,
    defaults: {
      ...DEFAULT_RULES.defaults,
      ...partial.defaults
    },
    pollIntervalMs: Number(partial.pollIntervalMs) > 250 ? Number(partial.pollIntervalMs) : DEFAULT_RULES.pollIntervalMs,
    idleThresholdSeconds:
      Number(partial.idleThresholdSeconds) > 10
        ? Number(partial.idleThresholdSeconds)
        : DEFAULT_RULES.idleThresholdSeconds
  }
}

export function watchRules(rulesPath: string, onChange: () => void): () => void {
  ensureRulesFile(rulesPath)
  let timer: NodeJS.Timeout | undefined
  const watcher = watch(rulesPath, () => {
    clearTimeout(timer)
    timer = setTimeout(onChange, 300)
  })
  return () => {
    clearTimeout(timer)
    watcher.close()
  }
}
