import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fork, type ChildProcess } from 'node:child_process'

// Starts the NEXUS Express API together with `npm run dev`, so data is always saved to server/data/state.json.
function nexusApi(): Plugin {
  let child: ChildProcess | null = null
  return {
    name: 'nexus-api',
    apply: 'serve',
    configureServer() {
      if (child) return
      child = fork('server/index.cjs', [], { stdio: 'inherit' })
      const stop = () => { child?.kill(); child = null }
      process.on('exit', stop)
      process.on('SIGINT', () => { stop(); process.exit() })
    },
  }
}

export default defineConfig({
  plugins: [react(), nexusApi()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
