import { contextBridge, ipcRenderer } from 'electron'
import type { Snapshot } from '../shared/types'

const api = {
  getSnapshot: (): Promise<Snapshot> => ipcRenderer.invoke('snapshot'),
  setPaused: (paused: boolean): Promise<Snapshot> => ipcRenderer.invoke('set-paused', paused),
  openRules: (): Promise<string> => ipcRenderer.invoke('open-rules'),
  openData: (): Promise<string> => ipcRenderer.invoke('open-data'),
  openAccessibility: (): Promise<void> => ipcRenderer.invoke('open-accessibility'),
  openAutomation: (): Promise<void> => ipcRenderer.invoke('open-automation'),
  signIn: (): Promise<Snapshot> => ipcRenderer.invoke('sign-in'),
  signOut: (): Promise<Snapshot> => ipcRenderer.invoke('sign-out'),
  onSnapshot: (listener: (snapshot: Snapshot) => void): (() => void) => {
    const wrapped = (_event: unknown, snapshot: Snapshot): void => listener(snapshot)
    ipcRenderer.on('snapshot', wrapped)
    return () => {
      ipcRenderer.removeListener('snapshot', wrapped)
    }
  }
}

contextBridge.exposeInMainWorld('createMeter', api)

export type CreateMeterApi = typeof api
