import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Standalone renderer dev server for previewing the Live HUD in a plain browser
 * (mirrors the `renderer` block of electron.vite.config.ts). Lets the
 * `?hud-preview` route be viewed/screenshotted without launching Electron.
 * Run: npx vite --config vite.hud.config.ts
 */
export default defineConfig({
  root: resolve(__dirname),
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  plugins: [react()],
  server: { port: 5199, strictPort: true }
})
