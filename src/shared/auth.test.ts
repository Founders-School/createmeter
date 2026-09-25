import { describe, expect, it } from 'vitest'
import {
  AuthDomainError,
  allowedEmailHint,
  decodeJwtPayload,
  emailDomain,
  isAllowedEmail,
  sessionIsFresh,
  userFromIdToken
} from './auth'

function fakeJwt(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `hdr.${body}.sig`
}

describe('email allowlist', () => {
  it('accepts Alpha School and Founders School Google accounts', () => {
    expect(isAllowedEmail('ada@alpha.school')).toBe(true)
    expect(isAllowedEmail('Nat@Alpha.School')).toBe(true)
    expect(isAllowedEmail('coach@founders.school')).toBe(true)
    expect(emailDomain('ada@alpha.school')).toBe('alpha.school')
    expect(allowedEmailHint()).toBe('@alpha.school or @founders.school')
  })

  it('rejects personal and other school domains', () => {
    expect(isAllowedEmail('ada@gmail.com')).toBe(false)
    expect(isAllowedEmail('ada@alpha.school.com')).toBe(false)
    expect(isAllowedEmail('ada@notalpha.school')).toBe(false)
    expect(isAllowedEmail('')).toBe(false)
  })
})

describe('ID token gate', () => {
  it('builds a user from a verified Alpha School token', () => {
    const token = fakeJwt({
      aud: 'client.apps.googleusercontent.com',
      email: 'ada@alpha.school',
      email_verified: true,
      name: 'Ada',
      exp: Math.floor(Date.now() / 1000) + 3600
    })
    const user = userFromIdToken(decodeJwtPayload(token), 'client.apps.googleusercontent.com')
    expect(user).toMatchObject({ email: 'ada@alpha.school', name: 'Ada', emailVerified: true })
  })

  it('rejects a gmail account even if Google verified it', () => {
    const token = fakeJwt({
      email: 'ada@gmail.com',
      email_verified: true,
      exp: Math.floor(Date.now() / 1000) + 3600
    })
    expect(() => userFromIdToken(decodeJwtPayload(token))).toThrow(AuthDomainError)
  })
})

describe('session freshness', () => {
  it('treats near-expiry tokens as stale', () => {
    expect(
      sessionIsFresh({
        user: { email: 'ada@alpha.school', emailVerified: true },
        accessToken: 't',
        idToken: 'i',
        expiresAt: Date.now() + 10_000
      })
    ).toBe(false)
    expect(
      sessionIsFresh({
        user: { email: 'ada@alpha.school', emailVerified: true },
        accessToken: 't',
        idToken: 'i',
        expiresAt: Date.now() + 10 * 60_000
      })
    ).toBe(true)
  })
})
