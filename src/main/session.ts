import { safeStorage } from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { sessionIsFresh, type AuthSession } from '../shared/auth'
import { refreshSession } from './google-oauth'

export function sessionPath(userData: string): string {
  return join(userData, 'session.bin')
}

export function writeSession(userData: string, session: AuthSession): void {
  const json = JSON.stringify(session)
  if (safeStorage.isEncryptionAvailable()) {
    writeFileSync(sessionPath(userData), safeStorage.encryptString(json))
    return
  }
  writeFileSync(join(userData, 'session.json'), json, 'utf8')
}

export function clearSession(userData: string): void {
  for (const name of ['session.bin', 'session.json']) {
    const path = join(userData, name)
    if (existsSync(path)) unlinkSync(path)
  }
}

export function readSession(userData: string): AuthSession | null {
  try {
    const encrypted = sessionPath(userData)
    if (existsSync(encrypted) && safeStorage.isEncryptionAvailable()) {
      const json = safeStorage.decryptString(readFileSync(encrypted))
      return JSON.parse(json) as AuthSession
    }
    const plain = join(userData, 'session.json')
    if (existsSync(plain)) return JSON.parse(readFileSync(plain, 'utf8')) as AuthSession
  } catch (error) {
    console.warn('CreateMeter: could not read session', error)
  }
  return null
}

export async function restoreSession(userData: string): Promise<AuthSession | null> {
  const stored = readSession(userData)
  if (!stored?.user?.email) return null
  if (sessionIsFresh(stored)) return stored
  if (!stored.refreshToken) {
    clearSession(userData)
    return null
  }
  try {
    const next = await refreshSession(stored)
    writeSession(userData, next)
    return next
  } catch (error) {
    console.warn('CreateMeter: refresh failed', error)
    clearSession(userData)
    return null
  }
}
