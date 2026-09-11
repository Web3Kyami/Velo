import { defineConfig } from 'vite'
import { createCallsApi } from './server/calls-api.js'

export default defineConfig({
  build: {
    target: 'esnext',
  },
  plugins: [{
    name: 'velo-api',
    configureServer(server) {
      server.middlewares.use('/api', createCallsApi())
    },
  }],
})
