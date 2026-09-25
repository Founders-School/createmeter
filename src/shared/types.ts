export type Category = 'creating' | 'consuming' | 'neutral'

export type PermissionState = 'granted' | 'denied' | 'unknown' | 'unsupported'

export interface AppRule {
  match: string
  category: Category
}

export interface HostRule {
  host: string
  pathPrefix?: string
  category: Category
}

export interface Rules {
  version: 1
  notes: string
  pollIntervalMs: number
  idleThresholdSeconds: number
  browsers: string[]
  apps: AppRule[]
  hosts: HostRule[]
  defaults: {
    unknownApp: Category
    unknownBrowserHost: Category
  }
}

export interface FrontmostApp {
  name: string
  bundleId: string
}

export interface Sample {
  at: number
  appName: string
  bundleId: string
  url?: string
  host?: string
  path?: string
  category: Category
  reason: string
  idle: boolean
  locked: boolean
  paused: boolean
  counted: boolean
}

export interface DayTotals {
  date: string
  creatingMs: number
  consumingMs: number
  neutralMs: number
}

export interface PermissionsStatus {
  accessibility: PermissionState
  automation: PermissionState
}

export interface PublicUser {
  email: string
  createdAt?: number
}

export interface Snapshot {
  today: DayTotals
  week: DayTotals[]
  weekTotals: DayTotals
  current: Sample | null
  paused: boolean
  tracking: boolean
  platform: NodeJS.Platform | 'preview'
  isMac: boolean
  permissions: PermissionsStatus
  dataDir: string
  rulesPath: string
  idleThresholdSeconds: number
  preview: boolean
  signedIn: boolean
  user: PublicUser | null
  authConfigured: boolean
  authMessage: string
}

export const CATEGORIES: Category[] = ['creating', 'consuming', 'neutral']
