import {
  SOMNIA_TESTNET_ADDRESSES,
  SomniaMarkets,
  priceToProbability,
} from '@somnia-chain/markets-sdk'
import { somniaShannon } from '@somnia-chain/markets-sdk/chains'
import { findSuccessorRecord, getCallRecord, listCallsByWallet } from './storage.js'
import { resultFromOnchain, stateFromOnchain } from './settlement.js'

const chain = somniaShannon
const indexerUrl = process.env.VELO_INDEXER_URL || 'https://dev.smk.somnia.host/v1/graphql'
const wsRpcUrl = process.env.VELO_WS_RPC_URL || chain.rpcUrls.default.webSocket?.[0]
const exchange = new SomniaMarkets({ indexerUrl, chain, wsRpcUrl, addresses: SOMNIA_TESTNET_ADDRESSES })
const proofUrl = (transactionHash) => `${chain.blockExplorers.default.url}/tx/${transactionHash}`

const fallbackState = (record) => Number(record.expiry) > Math.floor(Date.now() / 1000) ? 'Live' : 'Receipt'

const toPublicCall = async (record, includeProof = false, includeSuccessor = true) => {
  const [market, onchain] = await Promise.all([
    exchange.client.getBinaryMarket(record.marketId).catch(() => null),
    exchange.client.getMarketOnchain(record.marketId).catch(() => null),
  ])

  let currentProbability = null
  if (market?.lastPrice !== null && market?.lastPrice !== undefined) {
    currentProbability = priceToProbability(market.lastPrice, market.quoteDecimals) * 100
  }

  const state = onchain ? stateFromOnchain(onchain) : fallbackState(record)
  const result = onchain ? resultFromOnchain(onchain, record.outcomeIndex ?? (record.outcome === 'No' ? 1 : 0)) : null
  const resolution = result ? await exchange.client.getMarketResolution(record.marketId).catch(() => null) : null
  const successorRecord = includeSuccessor && result ? await findSuccessorRecord(record).catch(() => null) : null

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
    backing: {
      available: state === 'Live' && Number(record.expiry) > Math.floor(Date.now() / 1000),
      key: record.marketId,
    },
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

export const getPublicCallRecord = async (id, includeProof = false) => {
  const record = await getCallRecord(id)
  if (!record) return null
  return toPublicCall(record, includeProof)
}

export const getPublicProfileRecord = async (walletAddress) => {
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
