import type { FrontmostApp } from './types'

export interface SimulatedWorld {
  app: FrontmostApp
  url?: string
  idle: boolean
  locked: boolean
}

const SCENES: SimulatedWorld[] = [
  { app: { name: 'Cursor', bundleId: 'com.todesktop.230313mzl4w4u92' }, idle: false, locked: false },
  { app: { name: 'iTerm2', bundleId: 'com.googlecode.iterm2' }, idle: false, locked: false },
  {
    app: { name: 'Google Chrome', bundleId: 'com.google.Chrome' },
    url: 'https://github.com/nat/createmeter',
    idle: false,
    locked: false
  },
  {
    app: { name: 'Safari', bundleId: 'com.apple.Safari' },
    url: 'https://docs.google.com/document/d/demo',
    idle: false,
    locked: false
  },
  { app: { name: 'Slack', bundleId: 'com.tinyspeck.slackmacgap' }, idle: false, locked: false },
  {
    app: { name: 'Arc', bundleId: 'company.thebrowser.Browser' },
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    idle: false,
    locked: false
  },
  {
    app: { name: 'Safari', bundleId: 'com.apple.Safari' },
    url: 'https://news.ycombinator.com',
    idle: false,
    locked: false
  },
  { app: { name: 'Mail', bundleId: 'com.apple.mail' }, idle: false, locked: false },
  { app: { name: 'Cursor', bundleId: 'com.todesktop.230313mzl4w4u92' }, idle: true, locked: false }
]

export function simulatedWorld(at = Date.now()): SimulatedWorld {
  return SCENES[Math.floor(at / 8000) % SCENES.length]
}
