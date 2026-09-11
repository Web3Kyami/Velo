import { createHash } from 'node:crypto'
import {
  SOMNIA_TESTNET_ADDRESSES,
  SomniaMarkets,
  orderBookEventsAbi,
  priceToProbability,
  toHumanString,
} from '@somnia-chain/markets-sdk'
import { createPublicClient, http, isAddress, parseEventLogs } from 'viem'
import { somniaShannon } from '@somnia-chain/markets-sdk/chains'
import { findSuccessorRecord, getCallRecord, listCallsByWallet, prepareStorage, saveCallRecord, storageMode } from './storage.js'
import { resultFromOnchain, stateFromOnchain } from './settlement.js'

const chain = somniaShannon
const indexerUrl = process.env.VELO_INDEXER_URL || 'https://dev.smk.somnia.host/v1/graphql'
const wsRpcUrl = process.env.VELO_WS_RPC_URL || chain.rpcUrls.default.webSocket?.[0]
const exchange = new SomniaMarkets({ indexerUrl, chain, wsRpcUrl, addresses: SOMNIA_TESTNET_ADDRESSES })
const publicClient = createPublicClient({ chain, transport: http(process.env.VELO_RPC_URL || chain.rpcUrls.default.http[0]) })
const writeLimit = { windowMs: 60_000, max: 12 }
const writeAttempts = new Map()

const json = (response, status, body) => {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

const readBody = async (request) => {
  let raw = ''
  for await (const chunk of request) raw += chunk
  if (raw.length > 16_000) throw new Error('Request is too large.')
  return JSON.parse(raw || '{}')
}

const validHash = (hash) => typeof hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(hash)
const validMarketId = (marketId) => typeof marketId === 'string' && /^0x[0-9a-fA-F]{64}$/.test(marketId)
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

const allowWrite = (request) => {
  const key = request.socket?.remoteAddress || 'unknown'
  const now = Date.now()
  const previous = writeAttempts.get(key)
  if (!previous || previous.resetAt <= now) {
    writeAttempts.set(key, { count: 1, resetAt: now + writeLimit.windowMs })
    return true
  }
  if (previous.count >= writeLimit.max) return false
  previous.count += 1
  return true
}

const waitForIndexedFills = async (walletAddress, marketId, transactionHash) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const fills = await exchange.client.getUserFills(walletAddress, { market: marketId, limit: 100 })
    const matches = fills.filter((fill) => fill.txHash?.toLowerCase() === transactionHash.toLowerCase())
    if (matches.length > 0) return matches
    await sleep(1000)
  }
  return []
}

const summarizeFills = (fills, walletAddress, market) => {
  const scale = 10n ** BigInt(market.quoteDecimals)
  let quantity = 0n
  let costNumerator = 0n
  let outcome = null
  let outcomeIndex = null
  for (const fill of fills) {
    const takerOwner = fill.takerOrder?.owner?.toLowerCase() || fill.taker?.toLowerCase()
    const side = fill.takerOrder?.side || fill.takerSide
    if (takerOwner !== walletAddress.toLowerCase() || !side?.startsWith('BUY_')) continue
    const filledQuantity = BigInt(fill.quantity)
    if (filledQuantity <= 0n) continue
    const yesPrice = BigInt(fill.fillPrice)
    const selectedPrice = side === 'BUY_YES' ? yesPrice : scale - yesPrice
    quantity += filledQuantity
    costNumerator += filledQuantity * selectedPrice
    outcome = side === 'BUY_YES' ? 'Yes' : 'No'
    outcomeIndex = side === 'BUY_YES' ? 0 : 1
  }
  if (!outcome || quantity === 0n) return null
  const cost = costNumerator / scale
  return {
    outcome,
    outcomeIndex,
    filledQuantity: toHumanString(quantity, market.baseDecimals),
    actualCost: toHumanString(cost, market.quoteDecimals),
    entryProbability: Number(costNumerator) / Number(quantity * scale) * 100,
    quantityRaw: quantity.toString(),
    costRaw: cost.toString(),
  }
}

const callIdFor = (marketId, transactionHash) => createHash('sha256').update(`${marketId.toLowerCase()}:${transactionHash.toLowerCase()}`).digest('hex').slice(0, 24)

const proofUrl = (transactionHash) => `${chain.blockExplorers.default.url}/tx/${transactionHash}`

const toPublicCall = async (record, includeProof, includeSuccessor = true) => {
  const market = await exchange.client.getBinaryMarket(record.marketId)
  let currentProbability = null
  let state = 'Receipt'
  let result = null
  let resolution = null
  const onchain = await exchange.client.getMarketOnchain(record.marketId).catch(() => null)
  if (market) {
    if (market.lastPrice !== null) currentProbability = priceToProbability(market.lastPrice, market.quoteDecimals) * 100
  }
  if (onchain) {
    state = stateFromOnchain(onchain)
    result = resultFromOnchain(onchain, record.outcomeIndex ?? (record.outcome === 'No' ? 1 : 0))
  }
  if (result) {
    resolution = await exchange.client.getMarketResolution(record.marketId).catch(() => null)
  }
  const successorRecord = includeSuccessor && result ? await findSuccessorRecord(record) : null
  const publicView = {
    id: record.id,
    state,
    asset: record.asset,
    interval: record.interval,
    question: record.question,
    outcome: record.outcome,
    result,
    entryProbability: record.entryProbability,
    currentProbability,
    filledQuantity: record.filledQuantity,
    actualCost: record.actualCost,
    expiry: record.expiry,
    createdAt: record.createdAt,
    proofAvailable: true,
    backing: { available: Boolean(market) && state === 'Live', key: record.marketId },
    successor: successorRecord ? await toPublicCall(successorRecord, false, false) : null,
  }
  if (!includeProof) return publicView
  return {
    ...publicView,
    proof: {
      transactionHash: record.transactionHash,
      marketId: record.marketId,
      walletAddress: record.walletAddress,
      fillBlockNumber: record.fillBlockNumber,
      verifiedAt: record.verifiedAt,
      url: proofUrl(record.transactionHash),
      oracleQuestionId: market?.oracleQuestionId || null,
      resolutionTransactionHash: resolution?.events?.at(-1)?.txHash || null,
    },
  }
}

const toPublicProfile = async (walletAddress) => {
  const records = await listCallsByWallet(walletAddress)
  const calls = await Promise.all(records.map((record) => toPublicCall(record, false)))
  const settled = calls.filter((call) => call.result === 'Won' || call.result === 'Lost')
  const wins = settled.filter((call) => call.result === 'Won').length
  return {
    walletAddress,
    settledCalls: settled.length,
    accuracy: settled.length ? wins / settled.length * 100 : null,
    calls,
  }
}

const toClaimablePosition = (position) => ({
  marketId: position.marketId,
  pool: position.pool,
  outcome: position.outcomeIdx === 0 ? 'Yes' : 'No',
  amountRaw: position.amount.toString(),
  estimatedPayoutRaw: position.estPayout.toString(),
  status: position.status,
})

const getClaimablePositions = async (walletAddress) => {
  const positions = await exchange.client.getClaimable(walletAddress)
  return positions.map(toClaimablePosition)
}

const createVerifiedCall = async ({ marketId, transactionHash, walletAddress }) => {
  const market = await exchange.client.getBinaryMarket(marketId)
  if (!market) throw new Error('That market is not available on the testnet indexer.')
  const transaction = await publicClient.getTransaction({ hash: transactionHash })
  const receipt = await publicClient.getTransactionReceipt({ hash: transactionHash })
  if (transaction.from?.toLowerCase() !== walletAddress.toLowerCase()) throw new Error('The transaction sender does not match the connected wallet.')
  if (receipt.status !== 'success') throw new Error('The transaction did not confirm successfully.')
  const filledLogs = parseEventLogs({ abi: orderBookEventsAbi, logs: receipt.logs, eventName: 'OrderFilled', strict: false })
  if (!filledLogs.some((log) => log.address.toLowerCase() === market.poolAddress.toLowerCase())) throw new Error('The confirmed transaction contains no fill for this market.')
  const fills = await waitForIndexedFills(walletAddress, market.marketId, transactionHash)
  const summary = summarizeFills(fills, walletAddress, market)
  if (!summary) throw new Error('The confirmed transaction has no indexed nonzero buy fill for this market.')
  const id = callIdFor(market.marketId, transactionHash)
  const existing = await getCallRecord(id)
  if (existing) return existing
  const record = {
    id,
    marketId: market.marketId,
    transactionHash,
    walletAddress: walletAddress.toLowerCase(),
    asset: market.asset,
    interval: market.interval,
    question: market.question,
    outcome: summary.outcome,
    outcomeIndex: summary.outcomeIndex,
    entryProbability: summary.entryProbability,
    filledQuantity: summary.filledQuantity,
    actualCost: summary.actualCost,
    expiry: market.expiry,
    fillBlockNumber: receipt.blockNumber.toString(),
    createdAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
  }
  return saveCallRecord(record)
}

export function createCallsApi() {
  return async (request, response, next) => {
    const requestUrl = new URL(request.url || '/', 'http://velo.local')
    const pathname = requestUrl.pathname.replace(/^\/api/, '')
    try {
      if (request.method === 'GET' && pathname === '/health') {
        await prepareStorage()
        return json(response, 200, { ok: true, storage: storageMode, testnetOnly: true })
      }
      if (request.method === 'POST' && pathname === '/calls') {
        if (!allowWrite(request)) {
          response.setHeader('retry-after', '60')
          return json(response, 429, { error: 'Too many Call submissions. Try again shortly.' })
        }
        const body = await readBody(request)
        if (!validMarketId(body.marketId) || !validHash(body.transactionHash) || !isAddress(body.walletAddress)) return json(response, 400, { error: 'A market id, transaction hash, and wallet address are required.' })
        const record = await createVerifiedCall({ marketId: body.marketId, transactionHash: body.transactionHash, walletAddress: body.walletAddress })
        return json(response, 201, await toPublicCall(record, false))
      }
      const match = pathname.match(/^\/calls\/([a-f0-9]{24})$/i)
      if (request.method === 'GET' && match) {
        const record = await getCallRecord(match[1].toLowerCase())
        if (!record) return json(response, 404, { error: 'Call not found.' })
        return json(response, 200, await toPublicCall(record, requestUrl.searchParams.get('proof') === '1'))
      }
      const claimableMatch = pathname.match(/^\/claimable\/(0x[a-f0-9]{40})$/i)
      if (request.method === 'GET' && claimableMatch) {
        return json(response, 200, { walletAddress: claimableMatch[1], positions: await getClaimablePositions(claimableMatch[1]) })
      }
      const profileMatch = pathname.match(/^\/profile\/(0x[a-f0-9]{40})$/i)
      if (request.method === 'GET' && profileMatch) {
        return json(response, 200, await toPublicProfile(profileMatch[1]))
      }
      if (next) return next()
      return json(response, 404, { error: 'Not found.' })
    } catch (error) {
      return json(response, error instanceof SyntaxError ? 400 : 422, { error: error instanceof Error ? error.message : 'Call verification failed.' })
    }
  }
}
