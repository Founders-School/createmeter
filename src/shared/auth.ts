export const ALLOWED_EMAIL_DOMAINS = ['alpha.school', 'founders.school'] as const

export interface AuthUser {
  email: string
  name?: string
  picture?: string
  emailVerified: boolean
}

export interface AuthSession {
  user: AuthUser
  accessToken: string
  refreshToken?: string
  idToken: string
  expiresAt: number
}

export interface GoogleIdTokenPayload {
  aud?: string
  email?: string
  email_verified?: boolean | string
  name?: string
  picture?: string
  exp?: number
  hd?: string
}

export class AuthDomainError extends Error {
  readonly email: string

  constructor(email: string) {
    super(`Sign-in is limited to Alpha School Google accounts (${ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(', ')}).`)
    this.name = 'AuthDomainError'
    this.email = email
  }
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@')
  return at === -1 ? '' : email.slice(at + 1).trim().toLowerCase()
}

export function isAllowedEmail(email: string | undefined | null): boolean {
  if (!email) return false
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(emailDomain(email))
}

export function decodeJwtPayload(token: string): GoogleIdTokenPayload {
  const parts = token.split('.')
  if (parts.length < 2) throw new Error('Invalid ID token')
  const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const json = Buffer.from(padded, 'base64').toString('utf8')
  return JSON.parse(json) as GoogleIdTokenPayload
}

export function userFromIdToken(payload: GoogleIdTokenPayload, expectedAudience?: string): AuthUser {
  const email = payload.email?.trim().toLowerCase() ?? ''
  const verified = payload.email_verified === true || payload.email_verified === 'true'
  if (!email) throw new Error('Google did not return an email address.')
  if (!verified) throw new Error('Google has not verified that email address.')
  if (expectedAudience && payload.aud && payload.aud !== expectedAudience) {
    throw new Error('This sign-in was issued for a different app.')
  }
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error('That sign-in expired. Try again.')
  }
  if (!isAllowedEmail(email)) throw new AuthDomainError(email)
  return {
    email,
    name: payload.name,
    picture: payload.picture,
    emailVerified: true
  }
}

export function sessionIsFresh(session: AuthSession, skewMs = 60_000): boolean {
  return Boolean(session.user?.email) && session.expiresAt - skewMs > Date.now()
}

export function allowedEmailHint(): string {
  return ALLOWED_EMAIL_DOMAINS.map((domain) => `@${domain}`).join(' or ')
}

export function publicUser(user: AuthUser | null | undefined): AuthUser | null {
  if (!user?.email) return null
  return {
    email: user.email,
    name: user.name,
    picture: user.picture,
    emailVerified: user.emailVerified
  }
}
