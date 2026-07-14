import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth':     'http://localhost:8000',
      '/projects': 'http://localhost:8000',
      '/reviews':  'http://localhost:8000',
      '/reports':  'http://localhost:8000',
      '/lint':     'http://localhost:8000',
      '/suggest':  'http://localhost:8000',
      '/health':   'http://localhost:8000',
      '/workspaces': 'http://localhost:8000',
      '/ws':       { target: 'ws://localhost:8000', ws: true },
    },
  },
})
