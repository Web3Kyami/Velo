const testnet = import.meta.env.VITE_DREAMDEX_NETWORK !== 'mainnet'
const indexerUrl = import.meta.env.VITE_DREAMDEX_INDEXER_URL || (testnet
  ? 'https://dev.smk.somnia.host/v1/graphql'
  : 'https://prd.smk.somnia.host/v1/graphql')

let exchange
let sdk
const cache = new Map()
const queue = []
let activeLoads = 0
const MAX_ACTIVE_LOADS = 2
const MAX_POINTS = 60

const ready = Promise.all([
  import('@somnia-chain/markets-sdk'),
  import('@somnia-chain/markets-sdk/chains'),
]).then(([marketsSdk, chains]) => {
  const chain = testnet ? chains.somniaShannon : chains.somniaMainnet
  const wsRpcUrl = import.meta.env.VITE_DREAMDEX_WS_RPC_URL || chain.rpcUrls.default.webSocket?.[0]
  const addresses = testnet ? marketsSdk.SOMNIA_TESTNET_ADDRESSES : marketsSdk.SOMNIA_MAINNET_ADDRESSES
  sdk = marketsSdk
  exchange = new marketsSdk.SomniaMarkets({ indexerUrl, chain, wsRpcUrl, addresses })
  return exchange
})

const runQueued = (task) => new Promise((resolve, reject) => {
  queue.push({ task, resolve, reject })
  pumpQueue()
})

const pumpQueue = () => {
  while (activeLoads < MAX_ACTIVE_LOADS && queue.length) {
    const job = queue.shift()
    activeLoads += 1
    Promise.resolve()
      .then(job.task)
      .then(job.resolve, job.reject)
      .finally(() => {
        activeLoads -= 1
        pumpQueue()
      })
  }
}

const timeValue = (candle) => Number(candle.timestamp ?? candle.time ?? candle.bucketStart ?? candle.openTime ?? candle.start ?? 0)
const closeValue = (candle) => candle.close ?? candle.closePrice ?? candle.last ?? candle.price ?? null

const asProbability = (raw, decimals) => {
  if (raw === null || raw === undefined) return null
  try {
    const value = sdk.priceToProbability(raw, decimals) * 100
    if (Number.isFinite(value)) return Math.max(0, Math.min(100, value))
  } catch {}
  const numeric = Number(raw)
  if (!Number.isFinite(numeric)) return null
  if (numeric >= 0 && numeric <= 1) return numeric * 100
  if (numeric >= 0 && numeric <= 100) return numeric
  return null
}

const bucketFor = (market) => {
  const duration = Math.max(60, Number(market.expiry || 0) - Number(market.tradingStart || market.startTime || 0))
  if (duration <= 20 * 60) return 60
  if (duration <= 2 * 60 * 60) return 300
  return 900
}

const compactSeries = (series) => {
  if (series.length <= MAX_POINTS) return series
  const step = Math.ceil(series.length / MAX_POINTS)
  const compact = series.filter((_, index) => index % step === 0)
  const last = series.at(-1)
  if (last && compact.at(-1)?.t !== last.t) compact.push(last)
  return compact
}

const fetchSeries = async (market) => {
  const currentExchange = await ready
  const key = market.marketId.toLowerCase()
  const from = Number(market.tradingStart ?? market.startTime ?? Math.max(0, Number(market.expiry) - 3600))
  const to = Number(market.expiry)
  const candles = await currentExchange.client.getCandles(market.poolAddress, bucketFor(market), { from, to })
  const series = (Array.isArray(candles) ? candles : [])
    .filter((candle) => {
      const candleMarket = String(candle.marketId ?? candle.market ?? '').toLowerCase()
      return !candleMarket || candleMarket === key
    })
    .map((candle, index) => ({
      t: timeValue(candle) || index,
      value: asProbability(closeValue(candle), market.quoteDecimals),
    }))
    .filter((point) => point.value !== null)
    .sort((a, b) => a.t - b.t)
  return compactSeries(series)
}

const emitReady = (marketId, series) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('velo:chart-ready', {
    detail: { marketId, series },
  }))
}

export async function getMarketProbabilitySeries(marketOrId, waitForData = false) {
  const currentExchange = await ready
  const market = typeof marketOrId === 'string'
    ? await currentExchange.client.getBinaryMarket(marketOrId)
    : marketOrId
  if (!market?.marketId || !market?.poolAddress) return []

  const key = market.marketId.toLowerCase()
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < 15_000 && !cached.pending) return cached.series

  if (!cached?.pending) {
    const pending = runQueued(() => fetchSeries(market))
      .then((series) => {
        cache.set(key, { at: Date.now(), series, pending: null })
        emitReady(market.marketId, series)
        return series
      })
      .catch(() => {
        cache.set(key, { at: Date.now(), series: [], pending: null })
        emitReady(market.marketId, [])
        return []
      })
    cache.set(key, { at: Date.now(), series: cached?.series || [], pending })
  }

  const current = cache.get(key)
  if (waitForData && current?.pending) return current.pending
  return current?.series || []
}

export function linePath(series, width = 240, height = 54, pad = 3) {
  if (!Array.isArray(series) || series.length < 2) return ''
  const values = series.map((point) => Number(point.value)).filter(Number.isFinite)
  if (values.length < 2) return ''
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max - min < 2) { min -= 1; max += 1 }
  return values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2)
    const y = pad + (1 - (value - min) / (max - min)) * (height - pad * 2)
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

export function sparklineMarkup(series, className = 'market-sparkline', width = 240, height = 54) {
  const path = linePath(series, width, height)
  if (!path) return `<div class="${className} ${className}--empty"><span>Loading trend</span></div>`
  return `<svg class="${className}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Recent market probability"><path d="${path}" vector-effect="non-scaling-stroke"/></svg>`
}
