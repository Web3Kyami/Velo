import { isAddress } from 'viem'
import { getPublicProfileRecord } from '../../server/public-records.js'

const json = (response, status, body) => {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return json(response, 405, { error: 'Method not allowed.' })
  const url = new URL(request.url || '/', 'http://velo.local')
  const walletAddress = url.pathname.match(/\/api\/profile\/(0x[a-f0-9]{40})$/i)?.[1]?.toLowerCase()
  if (!walletAddress || !isAddress(walletAddress)) return json(response, 400, { error: 'Invalid wallet address.' })
  try {
    return json(response, 200, await getPublicProfileRecord(walletAddress))
  } catch (error) {
    return json(response, 422, { error: error instanceof Error ? error.message : 'Profile could not be loaded.' })
  }
}
