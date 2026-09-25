import { app } from 'electron'
import { isAllowedEmail, publicUser, sessionFromUser, type AuthSession } from '../shared/auth'
import { registerOrSignIn } from '../shared/password'
import type { Snapshot } from '../shared/types'
import { readAccounts, writeAccounts } from './accounts'
import { clearSession, restoreSession, writeSession } from './session'

export class AuthGate {
  session: AuthSession | null = null
  message = ''
  signingIn = false

  get signedIn(): boolean {
    return Boolean(this.session?.user?.email)
  }

  decorate(snapshot: Snapshot): Snapshot {
    return {
      ...snapshot,
      signedIn: this.signedIn,
      user: publicUser(this.session?.user),
      authConfigured: true,
      authMessage: this.message
    }
  }

  restore(userData: string): boolean {
    this.message = ''
    const dev = this.devSession()
    if (dev) {
      this.session = dev
      return true
    }
    this.session = restoreSession(userData)
    return this.signedIn
  }

  signIn(userData: string, email: string, password: string, confirmPassword?: string): Snapshot['user'] {
    if (this.signingIn) throw new Error('Sign-in is already in progress.')
    this.signingIn = true
    this.message = ''
    try {
      const next = registerOrSignIn(readAccounts(userData), email, password, confirmPassword)
      writeAccounts(userData, next.store)
      this.session = sessionFromUser(next.user)
      writeSession(userData, this.session)
      return publicUser(next.user)
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

  private devSession(): AuthSession | null {
    if (app.isPackaged) return null
    const email = process.env.CREATEMETER_DEV_USER?.trim().toLowerCase()
    if (!email || !isAllowedEmail(email)) return null
    return sessionFromUser({ email, createdAt: Date.now() })
  }
}
