import { isAddress, verifyMessage } from 'viem'
import { getProfileMetadata, saveProfileMetadata } from './profile-storage.js'

const json = (response, status, body) => {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

const readBody = async (request) => {
  let raw = ''
  for await (const chunk of request) raw += chunk
  if (raw.length > 8_000) throw new Error('Request is too large.')
  return JSON.parse(raw || '{}')
}

export const profileNameMessage = (walletAddress, displayName) => `Set Velo display name\nWallet: ${walletAddress.toLowerCase()}\nName: ${displayName}`

const cleanName = (value) => {
  const name = String(value || '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 24) throw new Error('Display name must be between 2 and 24 characters.')
  if (/[^\p{L}\p{N} _.-]/u.test(name)) throw new Error('Use letters, numbers, spaces, dots, underscores or hyphens.')
  return name
}

export function createProfileApi() {
  return async (request, response, next) => {
    const requestUrl = new URL(request.url || '/', 'http://velo.local')
    const match = requestUrl.pathname.match(/^(?:\/api)?\/profile-meta\/(0x[a-f0-9]{40})$/i)
    if (!match) return next ? next() : false

    const walletAddress = match[1].toLowerCase()
    if (!isAddress(walletAddress)) return json(response, 400, { error: 'Invalid wallet address.' })

    try {
      if (request.method === 'GET') {
        return json(response, 200, await getProfileMetadata(walletAddress))
      }

      if (request.method === 'POST') {
        const body = await readBody(request)
        const displayName = cleanName(body.displayName)
        if (typeof body.signature !== 'string' || !body.signature.startsWith('0x')) {
          return json(response, 400, { error: 'A wallet signature is required.' })
        }
        const message = profileNameMessage(walletAddress, displayName)
        const valid = await verifyMessage({ address: walletAddress, message, signature: body.signature })
        if (!valid) return json(response, 401, { error: 'The wallet signature could not be verified.' })
        return json(response, 200, await saveProfileMetadata(walletAddress, displayName))
      }

      return json(response, 405, { error: 'Method not allowed.' })
    } catch (error) {
      return json(response, error instanceof SyntaxError ? 400 : 422, { error: error instanceof Error ? error.message : 'Profile update failed.' })
    }
  }
}
