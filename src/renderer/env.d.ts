import type { CreateMeterApi } from '../preload/index'

export {}

declare global {
  interface Window {
    createMeter?: CreateMeterApi
  }
}
