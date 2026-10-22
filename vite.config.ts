/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/pmtools/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 600 },
  test: { environment: 'node' },
})
