import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config for the YouTube Comments Analyzer frontend.
// Frontend runs on port 3001 and calls the backend directly (no proxy).
// If port 3001 is busy, Vite will error instead of silently shifting ports.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    strictPort: true,
  },
})
