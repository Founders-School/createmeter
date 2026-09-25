import { describe, expect, it } from 'vitest'
import {
  AuthCredentialsError,
  AuthDomainError,
  allowedEmailHint,
  assertPassword,
  assertSchoolEmail,
  emailDomain,
  emptyAccountStore,
  isAllowedEmail,
  isLocalSession,
  normalizeEmail,
  publicUser
} from './auth'
import { hashPassword, passwordsMatch, registerOrSignIn } from './password'

describe('email allowlist', () => {
  it('accepts Alpha School and Founders School emails', () => {
    expect(isAllowedEmail('ada@alpha.school')).toBe(true)
    expect(isAllowedEmail('Nat@Alpha.School')).toBe(true)
    expect(isAllowedEmail('coach@founders.school')).toBe(true)
    expect(normalizeEmail('Nat@Alpha.School')).toBe('nat@alpha.school')
    expect(emailDomain('ada@alpha.school')).toBe('alpha.school')
    expect(allowedEmailHint()).toBe('@alpha.school or @founders.school')
    expect(assertSchoolEmail('Coach@Founders.School')).toBe('coach@founders.school')
  })

  it('rejects personal and other school domains', () => {
    expect(isAllowedEmail('ada@gmail.com')).toBe(false)
    expect(isAllowedEmail('ada@alpha.school.com')).toBe(false)
    expect(isAllowedEmail('ada@notalpha.school')).toBe(false)
    expect(isAllowedEmail('')).toBe(false)
    expect(() => assertSchoolEmail('ada@gmail.com')).toThrow(AuthDomainError)
    expect(() => assertSchoolEmail('ada@gmail.com')).toThrow(/@alpha.school/)
    expect(() => assertSchoolEmail('')).toThrow(AuthCredentialsError)
  })
})

describe('passwords', () => {
  it('rejects short or blank passwords', () => {
    expect(() => assertPassword('short')).toThrow(AuthCredentialsError)
    expect(() => assertPassword('        ')).toThrow(AuthCredentialsError)
    expect(assertPassword('longenough')).toBe('longenough')
  })

  it('hashes with scrypt and compares in constant time', () => {
    const record = hashPassword('longenough')
    expect(record.hash).not.toContain('longenough')
    expect(record.salt).not.toBe(hashPassword('longenough').salt)
    expect(passwordsMatch('longenough', record)).toBe(true)
    expect(passwordsMatch('wrongpass', record)).toBe(false)
  })
})

describe('local email login', () => {
  it('creates a school account on first use, then signs back in', () => {
    const first = registerOrSignIn(emptyAccountStore(), 'Ada@alpha.school', 'longenough', 'longenough')
    expect(first.created).toBe(true)
    expect(first.user.email).toBe('ada@alpha.school')
    expect(first.store.accounts).toHaveLength(1)
    expect(first.store.accounts[0].password.hash).toBeTruthy()

    const again = registerOrSignIn(first.store, 'ada@alpha.school', 'longenough')
    expect(again.created).toBe(false)
    expect(again.user.email).toBe('ada@alpha.school')
    expect(again.store.accounts).toHaveLength(1)
  })

  it('requires a matching confirmation only when creating', () => {
    expect(() => registerOrSignIn(emptyAccountStore(), 'ada@alpha.school', 'longenough')).toThrow(
      /Confirm your password/
    )
    expect(() =>
      registerOrSignIn(emptyAccountStore(), 'ada@alpha.school', 'longenough', 'different1')
    ).toThrow(/do not match/)
  })

  it('rejects the wrong password for an existing local account', () => {
    const { store } = registerOrSignIn(emptyAccountStore(), 'ada@alpha.school', 'longenough', 'longenough')
    expect(() => registerOrSignIn(store, 'ada@alpha.school', 'otherpass')).toThrow(
      /does not match this email/
    )
  })

  it('never creates a Gmail account', () => {
    expect(() => registerOrSignIn(emptyAccountStore(), 'ada@gmail.com', 'longenough', 'longenough')).toThrow(
      AuthDomainError
    )
  })
})

describe('session helpers', () => {
  it('accepts a local session and hides extra fields from the UI', () => {
    expect(isLocalSession({ user: { email: 'ada@alpha.school', createdAt: 1 }, signedInAt: 2 })).toBe(true)
    expect(isLocalSession({ user: { email: 'ada@alpha.school' }, accessToken: 'google' })).toBe(false)
    expect(publicUser({ email: 'ada@alpha.school', createdAt: 9 })).toEqual({
      email: 'ada@alpha.school',
      createdAt: 9
    })
  })
})
