import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Tauri expects a relative base path
  base: './',

  // Tauri uses a custom protocol, configure server
  server: {
    strictPort: true,
    port: 5173
  },

  // Optimize for production build
  build: {
    // Tauri uses Chromium-based webview
    target: 'esnext',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  }
})
