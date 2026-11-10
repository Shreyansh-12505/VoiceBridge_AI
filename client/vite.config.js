import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': {
        target: 'https://voicebridge-ai-3zos.onrender.com',
        changeOrigin: true,
        secure: true,
      },
      '/speech': {
        target: 'https://voicebridge-ai-3zos.onrender.com',
        changeOrigin: true,
        secure: true,
        ws: true,
      },
    },
  },
})
