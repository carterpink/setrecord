import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Renderer-only Vite config for in-browser preview.
 * The full Electron build uses `electron.vite.config.ts`. This config exists
 * so tools like Claude Preview can spawn a plain Vite dev server to inspect
 * the React UI without booting Electron.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  plugins: [react()]
})
