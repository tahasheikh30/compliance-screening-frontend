import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // fonts must be real files: the Content Security Policy (vercel.json) allows font-src 'self' but not data: URLs
  build: {
    assetsInlineLimit: 0,
    target: 'es2022',
    // Libraries change far less often than the app, so they get their own files: a redeploy of the app
    // leaves them cached in the browser. React is needed by every screen, Supabase only for signing in.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          if (id.includes('@supabase')) return 'supabase'
          return undefined
        },
      },
    },
  },
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
