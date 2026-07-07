/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cesium(),
  ],

  resolve: {
    // "@/" = the frontend root. MUST mirror the "paths" entry in
    // tsconfig.app.json: tsc uses that one to type-check, Vite uses this one
    // to actually resolve at build time — if they disagree, code type-checks
    // but fails to bundle (or vice versa). Vitest inherits this config, so
    // unit tests resolve the alias too.
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },

  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: true,
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'resium', 'cesium'],
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test-setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/playwright.config.*'],
    coverage: {
      provider: 'v8',
      // No thresholds YET — deliberately. The previous config gated at 80%
      // across the board while the suite had a single test file, so
      // `npm run test:coverage` could never pass and the number was fiction.
      // Reintroduce thresholds as ratchets (set them just below actuals and
      // raise as the suite grows) rather than aspirations.
    },
  },
})
