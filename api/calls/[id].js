import { getPublicCallRecord } from '../../server/public-records.js'

const json = (response, status, body) => {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return json(response, 405, { error: 'Method not allowed.' })
  const url = new URL(request.url || '/', 'http://velo.local')
  const id = url.pathname.match(/\/api\/calls\/([a-f0-9]{24})$/i)?.[1]?.toLowerCase()
  if (!id) return json(response, 400, { error: 'Invalid Call id.' })
  try {
    const call = await getPublicCallRecord(id, url.searchParams.get('proof') === '1')
    if (!call) return json(response, 404, { error: 'Call not found.' })
    return json(response, 200, call)
  } catch (error) {
    return json(response, 422, { error: error instanceof Error ? error.message : 'Call could not be loaded.' })
  }
}
