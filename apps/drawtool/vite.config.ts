import fs from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

function stampSitemapDates() {
  return {
    name: 'stamp-sitemap-dates',
    closeBundle() {
      const date = new Date().toISOString().split('T')[0]
      const distDir = resolve('dist')
      if (!fs.existsSync(distDir)) return
      for (const file of fs.readdirSync(distDir).filter(f => f.startsWith('sitemap') && f.endsWith('.xml'))) {
        const filePath = resolve(distDir, file)
        const updated = fs.readFileSync(filePath, 'utf-8').replace(/<lastmod>[^<]+<\/lastmod>/g, `<lastmod>${date}</lastmod>`)
        fs.writeFileSync(filePath, updated)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    stampSitemapDates(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
    }),
  ],
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'drawing-vendor': ['roughjs', 'perfect-freehand'],
        },
      },
    },
  },
})
