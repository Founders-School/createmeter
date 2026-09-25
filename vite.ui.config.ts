import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  server: {
    host: '127.0.0.1',
    port: 43147,
    strictPort: true,
    fs: {
      allow: [resolve(__dirname)]
    }
  }
})
