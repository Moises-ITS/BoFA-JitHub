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
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 },
    },
  },
})
