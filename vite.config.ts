import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Change this to your GitHub repository name if different.
const repoName = 'weight_tracker_app';
const isPages = process.env.GITHUB_ACTIONS === 'true';
const base = isPages ? `/${repoName}/` : '/';
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Keep Moving — Fitness Tracker', short_name: 'Keep Moving',
        description: 'Personal fitness journal with cloud sync',
        start_url: base, scope: base,
        display: 'standalone',
        background_color: '#f2f7f5', theme_color: '#123a3b',
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
});
