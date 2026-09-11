import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import { createCallsApi } from './calls-api.js'

const port = Number(process.env.PORT || 8787)
const host = process.env.HOST || '0.0.0.0'
const dist = resolve('dist')
const api = createCallsApi()
const contentTypes = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' }

const setSecurityHeaders = (response) => {
  response.setHeader('x-content-type-options', 'nosniff')
  response.setHeader('referrer-policy', 'strict-origin-when-cross-origin')
  response.setHeader('x-frame-options', 'DENY')
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()')
}

const serveFile = (response, pathname) => {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '')
  const filePath = resolve(join(dist, requested))
  const relativePath = relative(dist, filePath)
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath) || !existsSync(filePath) || !statSync(filePath).isFile()) return false
  response.statusCode = 200
  response.setHeader('content-type', contentTypes[extname(filePath)] || 'application/octet-stream')
  createReadStream(filePath).pipe(response)
  return true
}

createServer((request, response) => {
  setSecurityHeaders(response)
  if (request.url?.startsWith('/api/')) return api(request, response, () => { response.statusCode = 404; response.end() })
  if (request.method === 'GET' && serveFile(response, new URL(request.url || '/', 'http://velo.local').pathname)) return
  if (request.method === 'GET' && serveFile(response, '/index.html')) return
  response.statusCode = 404
  response.end('Not found')
}).listen(port, host, () => console.log(`Velo server listening on http://${host}:${port}`))
