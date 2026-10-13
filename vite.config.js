import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Fonts are found by the browser only after it has downloaded and read the stylesheet, which puts them a full
// round trip behind everything else and makes text jump when Inter arrives. The latin file covers every page,
// so tell the browser about it up front. The file name has a hash, so it is looked up in the finished build.
function preloadInterLatin() {
  return {
    name: 'preload-inter-latin',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const file = Object.keys(ctx.bundle || {}).find((f) => /inter-latin-wght-normal-.*\.woff2$/.test(f))
        if (!file) return undefined
        return [{ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `/${file}` }, injectTo: 'head-prepend' }]
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), preloadInterLatin()],
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
