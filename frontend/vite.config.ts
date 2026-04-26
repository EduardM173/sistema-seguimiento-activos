import { defineConfig } from 'vite'
import dotenv from "dotenv"
import react from '@vitejs/plugin-react'
import path from 'path'

dotenv.config()

export default defineConfig(() => {

  const VITE_HOST = process.env.VITE_HOST
  if (!VITE_HOST) {
    throw new Error("Falta VITE_HOST en el entorno")
  }

  const VITE_BACKEND_URL = process.env.VITE_BACKEND_URL
  if (!VITE_BACKEND_URL) {
    throw new Error("Falta VITE_BACKEND_URL en el entorno")
  }

  const port = parseInt(process.env.PORT || '5173', 10)

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',

      port: port,

      allowedHosts: [VITE_HOST],

      proxy: {
        "^\\/api.*$": {
          target: VITE_BACKEND_URL,
          changeOrigin: true
        }
      },

      cors: {
        origin: [`http://${VITE_HOST}`],
        methods: ['GET', 'OPTIONS', 'POST', 'PATCH', 'DELETE', 'PUT'],
        credentials: true,
      }
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@services': path.resolve(__dirname, './src/services'),
        '@types': path.resolve(__dirname, './src/types'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@styles': path.resolve(__dirname, './src/styles'),
      },
    },
  }
})