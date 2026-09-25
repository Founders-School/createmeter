import { safeStorage } from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isAllowedEmail, isLocalSession, type AuthSession } from '../shared/auth'

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
      return asLocalSession(JSON.parse(json))
    }
    const plain = join(userData, 'session.json')
    if (existsSync(plain)) return asLocalSession(JSON.parse(readFileSync(plain, 'utf8')))
  } catch (error) {
    console.warn('CreateMeter: could not read session', error)
  }
  return null
}

export function restoreSession(userData: string): AuthSession | null {
  const stored = readSession(userData)
  if (!stored || !isAllowedEmail(stored.user.email)) {
    if (stored) clearSession(userData)
    return null
  }
  return stored
}

function asLocalSession(value: unknown): AuthSession | null {
  if (!isLocalSession(value)) return null
  if (!isAllowedEmail(value.user.email)) return null
  return value
}
