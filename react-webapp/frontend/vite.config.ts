/// <reference types="vitest" />
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

  server: {
    host: '0.0.0.0',
    port: 5173,
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
