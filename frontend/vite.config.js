import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 4001,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../backend/key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../backend/cert.pem')),
    },
    proxy: {
      '/api': {
        target: 'https://127.0.0.1:4000',
        secure: false, // Don't verify self-signed cert on the backend
        changeOrigin: true
      },
      '/upload': {
        target: 'https://127.0.0.1:4000',
        secure: false,
        changeOrigin: true
      }
    }
  }
})
