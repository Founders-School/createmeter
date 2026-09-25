import { safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { emptyAccountStore, type AccountStore } from '../shared/auth'

export function accountsPath(userData: string): string {
  return join(userData, 'accounts.bin')
}

export function readAccounts(userData: string): AccountStore {
  try {
    const encrypted = accountsPath(userData)
    if (existsSync(encrypted) && safeStorage.isEncryptionAvailable()) {
      const json = safeStorage.decryptString(readFileSync(encrypted))
      return parseStore(json)
    }
    const plain = join(userData, 'accounts.json')
    if (existsSync(plain)) return parseStore(readFileSync(plain, 'utf8'))
  } catch (error) {
    console.warn('CreateMeter: could not read accounts', error)
  }
  return emptyAccountStore()
}

export function writeAccounts(userData: string, store: AccountStore): void {
  const json = JSON.stringify(store)
  if (safeStorage.isEncryptionAvailable()) {
    writeFileSync(accountsPath(userData), safeStorage.encryptString(json))
    return
  }
  writeFileSync(join(userData, 'accounts.json'), json, 'utf8')
}

function parseStore(json: string): AccountStore {
  const parsed = JSON.parse(json) as AccountStore
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.accounts)) {
    return emptyAccountStore()
  }
  return parsed
}
