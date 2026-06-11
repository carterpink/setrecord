import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // Expose VITE_* vars to the main process (same prefix as renderer so one .env entry covers both)
    envPrefix: ['MAIN_VITE_', 'VITE_'],
    build: {
      lib: {
        entry: resolve(__dirname, 'electron/main.ts')
      }
    }
  },
  preload: {
    build: {
      lib: {
        entry: resolve(__dirname, 'electron/preload.ts')
      }
    }
  },
  renderer: {
    root: resolve(__dirname),
    build: {
      rollupOptions: {
        input: {
          // Main app window.
          index: resolve(__dirname, 'index.html'),
          // Transparent always-on-top SetRecord Live overlay window.
          overlay: resolve(__dirname, 'overlay.html')
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    plugins: [react()]
  }
})
