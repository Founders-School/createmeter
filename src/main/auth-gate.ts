import { app } from 'electron'
import { allowedEmailHint, isAllowedEmail, publicUser, type AuthSession } from '../shared/auth'
import type { Snapshot } from '../shared/types'
import { googleClientId, signInWithGoogle } from './google-oauth'
import { clearSession, restoreSession, writeSession } from './session'

export class AuthGate {
  session: AuthSession | null = null
  message = ''
  signingIn = false

  get signedIn(): boolean {
    return Boolean(this.session?.user?.email)
  }

  get configured(): boolean {
    return Boolean(googleClientId())
  }

  decorate(snapshot: Snapshot): Snapshot {
    return {
      ...snapshot,
      signedIn: this.signedIn,
      user: publicUser(this.session?.user),
      authConfigured: this.configured || this.canUseDevUser(),
      authMessage: this.message
    }
  }

  async restore(userData: string): Promise<boolean> {
    this.message = ''
    const dev = this.devSession()
    if (dev) {
      this.session = dev
      return true
    }
    this.session = await restoreSession(userData)
    return this.signedIn
  }

  async signIn(userData: string): Promise<Snapshot['user']> {
    if (this.signingIn) throw new Error('Sign-in is already in progress.')
    this.signingIn = true
    this.message = ''
    try {
      const dev = this.devSession()
      if (dev) {
        this.session = dev
        writeSession(userData, dev)
        return publicUser(dev.user)
      }
      if (!this.configured) {
        throw new Error(
          `Google sign-in is not configured. Add GOOGLE_CLIENT_ID (see README). Allowed emails: ${allowedEmailHint()}.`
        )
      }
      this.session = await signInWithGoogle()
      writeSession(userData, this.session)
      return publicUser(this.session.user)
    } catch (error) {
      this.message = error instanceof Error ? error.message : 'Sign-in failed'
      throw error instanceof Error ? error : new Error(this.message)
    } finally {
      this.signingIn = false
    }
  }

  signOut(userData: string): void {
    this.session = null
    this.message = ''
    this.signingIn = false
    clearSession(userData)
  }

  private canUseDevUser(): boolean {
    return !app.isPackaged && isAllowedEmail(process.env.CREATEMETER_DEV_USER)
  }

  private devSession(): AuthSession | null {
    if (app.isPackaged) return null
    const email = process.env.CREATEMETER_DEV_USER?.trim().toLowerCase()
    if (!email || !isAllowedEmail(email)) return null
    return {
      user: { email, emailVerified: true, name: 'Local preview' },
      accessToken: 'dev',
      idToken: 'dev',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    }
  }
}
