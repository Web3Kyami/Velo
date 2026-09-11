import { defineConfig } from 'vite'
import { createVeloApi } from './server/api.js'

export default defineConfig({
  build: {
    target: 'esnext',
  },
  plugins: [{
    name: 'velo-api',
    configureServer(server) {
      server.middlewares.use('/api', createVeloApi())
    },
  }],
})
