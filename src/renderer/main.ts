import { ALLOWED_EMAIL_DOMAINS, allowedEmailHint } from '../shared/auth'
import {
  categoryLabel,
  creatingShare,
  formatDuration,
  longDateLabel,
  totalMs,
  weekdayLabel
} from '../shared/format'
import type { DayTotals, Snapshot } from '../shared/types'
import { createPreviewStore } from './preview'

const preview = createPreviewStore()
const CIRCUMFERENCE = 2 * Math.PI * 14

const $ = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing #${id}`)
  return node as T
}

function setArc(id: string, offset: number, value: number): void {
  const node = $(id)
  node.style.strokeDasharray = `${value} ${CIRCUMFERENCE}`
  node.style.strokeDashoffset = `${-offset}`
}

function renderDonut(day: DayTotals): void {
  const total = Math.max(totalMs(day), 1)
  const creating = (day.creatingMs / total) * CIRCUMFERENCE
  const consuming = (day.consumingMs / total) * CIRCUMFERENCE
  const neutral = (day.neutralMs / total) * CIRCUMFERENCE
  setArc('arc-creating', 0, creating)
  setArc('arc-consuming', creating, consuming)
  setArc('arc-neutral', creating + consuming, neutral)
}

function nowTitle(snapshot: Snapshot): string {
  const current = snapshot.current
  if (snapshot.paused) return 'Tracking paused'
  if (!current) return 'Waiting for first sample…'
  if (current.locked) return 'Mac is locked'
  if (current.idle) return `Idle · ${current.appName}`
  return current.host ? `${current.appName} · ${current.host}` : current.appName
}

function nowMeta(snapshot: Snapshot): string {
  const current = snapshot.current
  if (snapshot.paused) return 'Time is not counting until you resume.'
  if (!current) return 'The menu bar icon updates every couple of seconds.'
  if (current.locked) return 'Locked time is ignored.'
  if (current.idle) return `No input for ${snapshot.idleThresholdSeconds}s — not counted.`
  return `${categoryLabel(current.category)} · ${current.reason}`
}

function nowTone(snapshot: Snapshot): string {
  if (snapshot.paused) return 'paused'
  if (snapshot.current?.idle || snapshot.current?.locked) return 'idle'
  return snapshot.current?.category ?? 'neutral'
}

function renderWeek(snapshot: Snapshot): void {
  const max = Math.max(...snapshot.week.map((day) => totalMs(day)), 1)
  const today = snapshot.today.date
  $('week-bars').innerHTML = snapshot.week
    .map((day) => {
      const height = (n: number) => `${Math.max(0, (n / max) * 100)}%`
      return `<div class="day${day.date === today ? ' today' : ''}">
        <div class="stack" title="${formatDuration(totalMs(day))}">
          <span class="creating" style="height:${height(day.creatingMs)}"></span>
          <span class="consuming" style="height:${height(day.consumingMs)}"></span>
          <span class="neutral" style="height:${height(day.neutralMs)}"></span>
        </div>
        <em>${weekdayLabel(day.date)}</em>
      </div>`
    })
    .join('')

  $('week-summary').textContent =
    totalMs(snapshot.weekTotals) > 0
      ? `C ${formatDuration(snapshot.weekTotals.creatingMs)} · V ${formatDuration(snapshot.weekTotals.consumingMs)}`
      : 'No tracked time yet'
}

function renderBanner(snapshot: Snapshot): void {
  const banner = $('banner')
  if (snapshot.preview) {
    banner.textContent =
      'Preview of the Today window. On a Mac, CreateMeter lives in the menu bar and classifies the frontmost app and site.'
    banner.classList.remove('hidden')
    return
  }
  if (snapshot.isMac && snapshot.permissions.automation === 'denied') {
    banner.textContent =
      'Browser URLs are blocked. Use Grant Automation… in the menu so GitHub can count as creating and YouTube as consuming.'
    banner.classList.remove('hidden')
    return
  }
  banner.classList.add('hidden')
}

function renderGate(snapshot: Snapshot, signingIn = false): void {
  const gate = $('signin-gate')
  const error = $('signin-error')
  const button = $('signin') as HTMLButtonElement
  const note = $('signin-note')
  $('signin-allowlist').textContent = `Allowed: ${allowedEmailHint()}. Personal Gmail is rejected.`

  if (snapshot.signedIn) {
    gate.classList.add('hidden')
    return
  }

  gate.classList.remove('hidden')
  button.disabled = signingIn
  button.textContent = signingIn ? 'Waiting for Google…' : 'Sign in with Google'
  if (snapshot.authMessage) {
    error.textContent = snapshot.authMessage
    error.classList.remove('hidden')
  } else {
    error.classList.add('hidden')
  }
  note.textContent = snapshot.authConfigured
    ? 'A browser window opens for Google. Come back here when it says you are signed in.'
    : 'Google OAuth is not configured in this build. Nat still needs to add GOOGLE_CLIENT_ID (README).'
}

function render(snapshot: Snapshot, signingIn = false): void {
  renderGate(snapshot, signingIn)
  document.title = snapshot.signedIn ? 'Today — CreateMeter' : 'Sign in — CreateMeter'
  $('eyebrow').textContent = longDateLabel(snapshot.today.date)
  $('who').textContent = snapshot.user?.email ? `Signed in as ${snapshot.user.email}` : ''
  const share = creatingShare(snapshot.today)
  $('ratio').textContent =
    share === null
      ? totalMs(snapshot.today) === 0
        ? 'No tracked time yet'
        : 'No create/consume time yet'
      : `${Math.round(share * 100)}% creating`

  $('creating').textContent = formatDuration(snapshot.today.creatingMs)
  $('consuming').textContent = formatDuration(snapshot.today.consumingMs)
  $('neutral').textContent = formatDuration(snapshot.today.neutralMs)
  renderDonut(snapshot.today)

  const card = $('now-card')
  card.className = `now ${nowTone(snapshot)}`
  $('now-title').textContent = nowTitle(snapshot)
  $('now-meta').textContent = nowMeta(snapshot)
  renderWeek(snapshot)
  renderBanner(snapshot)

  const pause = $('pause') as HTMLButtonElement
  pause.textContent = snapshot.paused ? 'Resume tracking' : 'Pause tracking'
  pause.dataset.paused = snapshot.paused ? '1' : '0'
  pause.disabled = !snapshot.signedIn
}

async function start(): Promise<void> {
  const api = window.createMeter
  const pause = $('pause')
  const rules = $('rules')
  const signin = $('signin')
  const signout = $('signout')
  $('signin-allowlist').textContent = `Allowed: ${ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(' or ')}.`

  if (!api) {
    const wantGate = new URLSearchParams(window.location.search).get('gate') === '1'
    if (wantGate) render(preview.signOut())
    else render(preview.tick())
    window.setInterval(() => {
      if (preview.signedIn) render(preview.tick())
    }, 1000)
    pause.addEventListener('click', () => {
      const next = pause.dataset.paused !== '1'
      render(preview.setPaused(next))
    })
    rules.addEventListener('click', () => {
      window.alert('On a Mac this opens ~/Library/Application Support/CreateMeter/rules.json')
    })
    signin.addEventListener('click', () => {
      render(preview.signIn())
    })
    signout.addEventListener('click', () => {
      render(preview.signOut())
    })
    return
  }

  render(await api.getSnapshot())
  api.onSnapshot((snapshot) => render(snapshot))
  window.setInterval(async () => {
    render(await api.getSnapshot())
  }, 2000)

  pause.addEventListener('click', async () => {
    const next = pause.dataset.paused !== '1'
    render(await api.setPaused(next))
  })
  rules.addEventListener('click', () => {
    void api.openRules()
  })
  signin.addEventListener('click', async () => {
    render(await api.getSnapshot(), true)
    try {
      render(await api.signIn())
    } catch (error) {
      const snapshot = await api.getSnapshot()
      render({
        ...snapshot,
        authMessage: error instanceof Error ? error.message : snapshot.authMessage
      })
    }
  })
  signout.addEventListener('click', async () => {
    render(await api.signOut())
  })
}

void start()
