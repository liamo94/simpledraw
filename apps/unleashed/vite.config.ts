import fs from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
  plugins: [react(), tailwindcss(), stampSitemapDates()],
  appType: 'spa',
})
