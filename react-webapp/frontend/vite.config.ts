/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],

  server: {
    host: '0.0.0.0',
    port: 5173,
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
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
