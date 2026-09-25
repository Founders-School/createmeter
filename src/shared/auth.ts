export const ALLOWED_EMAIL_DOMAINS = ['alpha.school', 'founders.school'] as const
export const MIN_PASSWORD_LENGTH = 8

export interface AuthUser {
  email: string
  createdAt: number
}

export interface AuthSession {
  user: AuthUser
  signedInAt: number
}

export interface PasswordRecord {
  salt: string
  hash: string
  N: number
  r: number
  p: number
  keylen: number
}

export interface StoredAccount {
  email: string
  password: PasswordRecord
  createdAt: number
}

export interface AccountStore {
  version: 1
  accounts: StoredAccount[]
}

export interface PublicUser {
  email: string
  createdAt?: number
}

export class AuthDomainError extends Error {
  readonly email: string

  constructor(email: string) {
    super(
      `Sign-in is limited to Alpha School and Founders School emails (${ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(', ')}).`
    )
    this.name = 'AuthDomainError'
    this.email = email
  }
}

export class AuthCredentialsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthCredentialsError'
  }
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@')
  return at === -1 ? '' : email.slice(at + 1).trim().toLowerCase()
}

export function normalizeEmail(email: string | undefined | null): string {
  return email?.trim().toLowerCase() ?? ''
}

export function isAllowedEmail(email: string | undefined | null): boolean {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(emailDomain(normalized))
}

export function allowedEmailHint(): string {
  return ALLOWED_EMAIL_DOMAINS.map((domain) => `@${domain}`).join(' or ')
}

export function assertSchoolEmail(email: string | undefined | null): string {
  const normalized = normalizeEmail(email)
  if (!normalized || !normalized.includes('@')) {
    throw new AuthCredentialsError('Enter your school email.')
  }
  if (!isAllowedEmail(normalized)) throw new AuthDomainError(normalized)
  return normalized
}

export function assertPassword(password: string | undefined | null): string {
  const value = password ?? ''
  if (value.length < MIN_PASSWORD_LENGTH) {
    throw new AuthCredentialsError(`Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`)
  }
  if (value.trim().length === 0) {
    throw new AuthCredentialsError('Password cannot be only spaces.')
  }
  return value
}

export function emptyAccountStore(): AccountStore {
  return { version: 1, accounts: [] }
}

export function findAccount(store: AccountStore, email: string): StoredAccount | undefined {
  const normalized = normalizeEmail(email)
  return store.accounts.find((account) => account.email === normalized)
}

export function sessionFromUser(user: AuthUser, at = Date.now()): AuthSession {
  return { user, signedInAt: at }
}

export function isLocalSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false
  const session = value as AuthSession
  return Boolean(session.user?.email && typeof session.signedInAt === 'number')
}

export function publicUser(user: AuthUser | null | undefined): PublicUser | null {
  if (!user?.email) return null
  return { email: user.email, createdAt: user.createdAt }
}
