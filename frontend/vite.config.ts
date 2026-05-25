import { defineConfig } from 'vite'
import dotenv from "dotenv"
import react from '@vitejs/plugin-react'
import path from 'path'
import { deeplinkApi } from './vite-plugins/deeplink-api'
import { consulProxy } from './vite-plugins/consul-proxy'

dotenv.config()

export default defineConfig(() => {

  const FRONTEND_HOST_RAW = process.env.FRONTEND
  if (!FRONTEND_HOST_RAW) {
    throw new Error("Falta FRONEND_HOST en el entorno")
  }

  const FRONTEND_PORT_RAW = process.env.FRONTEND_PORT
  if(!FRONTEND_PORT_RAW){
    throw new Error("Falta FRONEND_PORT en el entorno")
  }
  const HOST: string = FRONTEND_HOST_RAW
  const PORT: number = parseInt(FRONTEND_PORT_RAW, 10)

  return {
    plugins: [react(), deeplinkApi(), consulProxy()],
    server: {
      host: '0.0.0.0',

      port: PORT,

      allowedHosts: [HOST],
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
