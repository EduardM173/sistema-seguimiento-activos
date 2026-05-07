import { defineConfig } from 'vite'
import dotenv from "dotenv"
import react from '@vitejs/plugin-react'
import path from 'path'
import { deeplinkApi } from './vite-plugins/deeplink-api'

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

  // Agent service (GraphRAG / DeeplinkAgent). Default apunta al stack
  // levantado por deploy_rag.sh. Sobrescribir con VITE_AGENT_URL si hace
  // falta (ej. localhost cuando se corre fuera de docker).
  const VITE_AGENT_URL = process.env.VITE_AGENT_URL || 'http://graphrag_app:8000'

  const port = parseInt(process.env.FRONTEND_PORT || '5173', 10)

  return {
    plugins: [react(), deeplinkApi()],
    server: {
      host: '0.0.0.0',

      port: port,

      allowedHosts: [VITE_HOST],

      proxy: {
        "^\\/api.*$": {
          target: VITE_BACKEND_URL,
          changeOrigin: true
        },
        // Proxy hacia el agent_service. El frontend habla con `/agent/...`
        // y Vite lo reescribe quitando el prefijo, así el agent recibe
        // p.ej. `/chat/sessions`.
        "^\\/agent/.*$": {
          target: VITE_AGENT_URL,
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/agent/, ''),
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