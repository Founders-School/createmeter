import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const googleClientId = JSON.stringify(
    process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || env.MAIN_VITE_GOOGLE_CLIENT_ID || ''
  )

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: {
        __GOOGLE_CLIENT_ID__: googleClientId
      }
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          output: {
            format: 'cjs',
            entryFileNames: 'index.js'
          }
        }
      }
    },
    renderer: {
      root: resolve(__dirname, 'src/renderer'),
      server: {
        host: '127.0.0.1',
        port: 43147,
        strictPort: true,
        fs: {
          allow: [resolve(__dirname)]
        }
      }
    }
  }
})
