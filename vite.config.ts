/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { PAGES, SITE_URL, type PageMeta } from './src/routes'

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** index.html with one page's title, description and canonical URL. */
function pageHtml(html: string, page: PageMeta) {
  const head = [
    `<link rel="canonical" href="${SITE_URL}${page.path}" />`,
    page.index === false ? '<meta name="robots" content="noindex" />' : '',
  ].filter(Boolean)
  return html
    .replace(/<title>.*?<\/title>/, `<title>${escape(page.title)}</title>`)
    .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${escape(page.description)}" />`)
    .replace('</head>', `    ${head.join('\n    ')}\n  </head>`)
}

/**
 * GitHub Pages only serves files that exist, so write a copy of index.html at every route
 * (e.g. method/rice/index.html) for clean URLs that survive a refresh, plus a 404 page and a sitemap.
 */
function staticRoutes(): Plugin {
  let outDir = 'dist'
  return {
    name: 'static-routes',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    // Runs after Vite has written index.html with the hashed asset links.
    closeBundle() {
      const write = (file: string, content: string) => {
        mkdirSync(dirname(resolve(outDir, file)), { recursive: true })
        writeFileSync(resolve(outDir, file), content)
      }
      const html = readFileSync(resolve(outDir, 'index.html'), 'utf8')
      for (const page of PAGES) write(`${page.path}index.html`, pageHtml(html, page))
      // Unknown paths still load the app, which shows the home page.
      write('404.html', pageHtml(html, { ...PAGES[0], index: false }))
      const urls = PAGES.filter((p) => p.index !== false).map((p) => `  <url><loc>${SITE_URL}${p.path}</loc></url>`)
      write(
        'sitemap.xml',
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
      )
    },
  }
}

export default defineConfig({
  base: '/pmtools/',
  plugins: [react(), staticRoutes()],
  build: { chunkSizeWarningLimit: 600 },
  test: { environment: 'node' },
})
