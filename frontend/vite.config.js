import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // No manualChunks: the lazy routes in App.tsx already split this well.
    // Pinning React into its own chunk breaks CJS interop with react-helmet
    // ("Cannot set properties of undefined (setting 'Children')"); leaving it
    // unpinned makes rollup fold React into `three`, which the entry then
    // preloads. Both were tried.

    // The campus chunk is ~1.4MB of three.js and LiveKit, which is the point.
    chunkSizeWarningLimit: 1500,
  },
  server: {
    allowedHosts: ['localhost', 'ufazien.com', 'www.ufazien.com',],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    // The default forks pool times out starting workers on Windows here.
    pool: 'threads',
  },
})
