import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // fonts must be real files: the Content Security Policy (vercel.json) allows font-src 'self' but not data: URLs
  build: { assetsInlineLimit: 0 },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
  },
})
