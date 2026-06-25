import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import Sitemap from 'vite-plugin-sitemap'

export default defineConfig({
  plugins: [
    react(),
    Sitemap({
      hostname: 'https://syn-forge.com',
      dynamicRoutes: ['/projects', '/certificates', '/snippets', '/snippets/root/', '/privacy-policy', '/terms-and-conditions', '/netbird', '/atelier'],
    })
  ],
  base: "/",
  server: {
    host: true,
    allowedHosts: ["yashindo.local", "dev.syn-forge.com", "yashindo.syn-forge.netbird", "portfolio.yashindo.syn-forge.com", "hiraeth.internal.netbird-network"]
  },
build: {
    chunkSizeWarningLimit: 1500, 
    rollupOptions: {
    },
  },
})
