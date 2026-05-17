import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Multi-page Vite config.
//
// Each HTML file at the project root is an entry point. Vite picks up the
// `<script type="module" src="/src/...jsx">` tag in each one, bundles its
// dependency graph, and writes hashed assets to `dist/`. The /api/ folder is
// not touched — Vercel runs those serverless functions independently of the
// frontend build.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main:               resolve(__dirname, 'index.html'),
        'recruiter-talent': resolve(__dirname, 'recruiter-talent.html'),
        'talent-match':     resolve(__dirname, 'talent-match.html'),
      },
    },
  },
})
