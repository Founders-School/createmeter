import { describe, expect, it } from 'vitest'
import { longDateLabel } from '../shared/format'
import { createPreviewStore } from './preview'

describe('Today preview store', () => {
  it('pauses and resumes without counting idle samples', () => {
    const store = createPreviewStore()
    const live = store.tick()
    expect(live.paused).toBe(false)
    expect(live.signedIn).toBe(true)
    expect(live.user?.email).toBe('ada@alpha.school')
    expect(live.today.creatingMs + live.today.consumingMs).toBeGreaterThan(0)

    const paused = store.setPaused(true)
    expect(paused.paused).toBe(true)
    expect(paused.current?.paused).toBe(true)
    expect(paused.tracking).toBe(false)

    const resumed = store.setPaused(false)
    expect(resumed.paused).toBe(false)
  })

  it('clears the session in the signed-out gate', () => {
    const store = createPreviewStore()
    const out = store.signOut()
    expect(out.signedIn).toBe(false)
    expect(out.user).toBeNull()
    expect(out.current).toBeNull()
    expect(out.tracking).toBe(false)
    expect(store.signIn('ada@alpha.school', 'longenough').signedIn).toBe(true)
  })

  it('creates a new school account and rejects Gmail', () => {
    const store = createPreviewStore()
    store.signOut()
    expect(() => store.signIn('ada@gmail.com', 'longenough', 'longenough')).toThrow(/alpha.school/)
    const created = store.signIn('coach@founders.school', 'longenough', 'longenough')
    expect(created.user?.email).toBe('coach@founders.school')
    store.signOut()
    expect(() => store.signIn('coach@founders.school', 'wrongpass1')).toThrow(/does not match/)
  })
})

describe('date labels', () => {
  it('formats a stable English date', () => {
    expect(longDateLabel('2026-09-25')).toBe('Friday, September 25')
  })
})
