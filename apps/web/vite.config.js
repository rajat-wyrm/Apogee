import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    compression({ algorithm: 'brotliCompress', ext: '.br' }),
    compression({ algorithm: 'gzip', ext: '.gz' }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Apogee',
        short_name: 'Apogee',
        description: 'The all-in-one productivity platform',
        theme_color: '#6366f1',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/ai\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'apogee-ai', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 } },
          },
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'apogee-api', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 } },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, host: true, proxy: { '/api': { target: 'http://localhost:5050', changeOrigin: true, secure: false }, '/socket.io': { target: 'http://localhost:5050', changeOrigin: true, ws: true } } },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['framer-motion', 'lucide-react', 'clsx', 'tailwind-merge', 'class-variance-authority'],
          data: ['@tanstack/react-query', 'zustand', 'axios', 'socket.io-client'],
          editor: ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder'],
          charts: ['recharts'],
        },
      },
    },
  },
});
