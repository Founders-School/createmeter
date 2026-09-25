import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import {
  assertPassword,
  assertSchoolEmail,
  findAccount,
  type AccountStore,
  type AuthUser,
  type PasswordRecord,
  type StoredAccount,
  AuthCredentialsError
} from './auth'

const SCRYPT = { N: 16_384, r: 8, p: 1, keylen: 32 } as const

export function hashPassword(password: string): PasswordRecord {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p })
  return {
    salt: salt.toString('base64'),
    hash: hash.toString('base64'),
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    keylen: SCRYPT.keylen
  }
}

export function passwordsMatch(password: string, record: PasswordRecord): boolean {
  const salt = Buffer.from(record.salt, 'base64')
  const expected = Buffer.from(record.hash, 'base64')
  const actual = scryptSync(password, salt, record.keylen, { N: record.N, r: record.r, p: record.p })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function registerOrSignIn(
  store: AccountStore,
  email: string,
  password: string,
  confirmPassword?: string
): { store: AccountStore; user: AuthUser; created: boolean } {
  const normalized = assertSchoolEmail(email)
  const secret = assertPassword(password)
  const existing = findAccount(store, normalized)

  if (!existing) {
    const confirm = confirmPassword ?? ''
    if (!confirm) {
      throw new AuthCredentialsError('Confirm your password to create an account on this Mac.')
    }
    if (confirm !== secret) {
      throw new AuthCredentialsError('Those passwords do not match.')
    }
    const createdAt = Date.now()
    const account: StoredAccount = {
      email: normalized,
      password: hashPassword(secret),
      createdAt
    }
    return {
      store: { version: 1, accounts: [...store.accounts, account] },
      user: { email: normalized, createdAt },
      created: true
    }
  }

  if (!passwordsMatch(secret, existing.password)) {
    throw new AuthCredentialsError('That password does not match this email on this Mac.')
  }

  return {
    store,
    user: { email: existing.email, createdAt: existing.createdAt },
    created: false
  }
}
