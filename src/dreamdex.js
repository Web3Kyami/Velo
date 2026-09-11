const testnet = import.meta.env.VITE_DREAMDEX_NETWORK !== 'mainnet'
const indexerUrl = import.meta.env.VITE_DREAMDEX_INDEXER_URL || (testnet
  ? 'https://dev.smk.somnia.host/v1/graphql'
  : 'https://prd.smk.somnia.host/v1/graphql')

export const networkLabel = testnet ? 'Somnia testnet' : 'Somnia mainnet'
export const collateralSymbol = testnet ? 'tUSDC' : 'USDso'
export const collateralDecimals = testnet ? 6 : 18
let exchange
let sdk
let walletAddress

const sdkPromise = Promise.all([
  import('@somnia-chain/markets-sdk'),
  import('@somnia-chain/markets-sdk/chains'),
  import('viem'),
]).then(([marketsSdk, chains, viem]) => {
  const chain = testnet ? chains.somniaShannon : chains.somniaMainnet
  const wsRpcUrl = import.meta.env.VITE_DREAMDEX_WS_RPC_URL || chain.rpcUrls.default.webSocket?.[0]
  const addresses = testnet ? marketsSdk.SOMNIA_TESTNET_ADDRESSES : marketsSdk.SOMNIA_MAINNET_ADDRESSES
  sdk = { ...marketsSdk, ...viem, chain }
  exchange = new marketsSdk.SomniaMarkets({ indexerUrl, chain, wsRpcUrl, addresses })
  return exchange
})

const getExchange = () => sdkPromise

export async function listVerifiedLiveMarkets() {
  const currentExchange = await getExchange()
  const indexedMarkets = await currentExchange.client.listLiveBinaryMarkets()
  const checkedMarkets = await Promise.all(indexedMarkets.map(async (market) => {
    const onchain = await currentExchange.client.getMarketOnchain(market.marketId)
    if (onchain.status !== 1 || onchain.isResolved || onchain.isVoided) return null
    return { market, onchain }
  }))
  return checkedMarkets.filter(Boolean)
}

export async function getBinaryBook(market) {
  const currentExchange = await getExchange()
  return currentExchange.client.getBinaryOrderBook(market.poolAddress, { depth: 1, decimals: market.quoteDecimals })
}

export function probabilityPercent(rawPrice, decimals) {
  if (rawPrice === null || rawPrice === undefined) return null
  return sdk.priceToProbability(rawPrice, decimals) * 100
}

const switchToExpectedChain = async () => {
  const targetChainId = `0x${sdk.chain.id.toString(16)}`
  const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
  if (currentChainId?.toLowerCase() === targetChainId.toLowerCase()) return
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetChainId }] })
  } catch (error) {
    if (error?.code !== 4902) throw new Error(`Switch your wallet to ${networkLabel} to continue.`)
    const explorerUrl = sdk.chain.blockExplorers?.default?.url
    await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: targetChainId, chainName: sdk.chain.name, nativeCurrency: sdk.chain.nativeCurrency, rpcUrls: sdk.chain.rpcUrls.default.http, blockExplorerUrls: explorerUrl ? [explorerUrl] : undefined }] })
  }
}

const attachSigner = async (address) => {
  const currentExchange = await getExchange()
  const walletClient = sdk.createWalletClient({ chain: sdk.chain, transport: sdk.custom(window.ethereum) })
  currentExchange.setSigner({ walletClient })
  walletAddress = address
  return address
}

export async function restoreWallet() {
  await getExchange()
  if (!window.ethereum) return null
  const accounts = await window.ethereum.request({ method: 'eth_accounts' })
  if (!accounts?.[0]) return null
  const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
  const expectedChainId = `0x${sdk.chain.id.toString(16)}`
  if (currentChainId?.toLowerCase() !== expectedChainId.toLowerCase()) return null
  return attachSigner(accounts[0])
}

export async function connectWallet() {
  await getExchange()
  if (!window.ethereum) throw new Error('No browser wallet was detected. Install MetaMask or another compatible wallet.')
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
  await switchToExpectedChain()
  const address = accounts?.[0] || (await window.ethereum.request({ method: 'eth_accounts' }))?.[0]
  if (!address) throw new Error('No wallet account was selected.')
  const connectedChainId = await window.ethereum.request({ method: 'eth_chainId' })
  const expectedChainId = `0x${sdk.chain.id.toString(16)}`
  if (connectedChainId?.toLowerCase() !== expectedChainId.toLowerCase()) throw new Error(`Your wallet is not connected to ${networkLabel}.`)
  return attachSigner(address)
}

export function getConnectedWallet() { return walletAddress }

const rawFillSummary = (fills, outcome, quoteDecimals, baseDecimals) => {
  const scale = 10n ** BigInt(quoteDecimals)
  let quantity = 0n
  let costNumerator = 0n
  for (const fill of fills) {
    const filled = BigInt(fill.quantityFilled)
    if (filled <= 0n) continue
    const yesPrice = BigInt(fill.fillPrice)
    const selectedPrice = outcome === 0 ? yesPrice : scale - yesPrice
    quantity += filled
    costNumerator += filled * selectedPrice
  }
  if (quantity === 0n) return null
  const cost = costNumerator / scale
  return { quantity, cost, filledQuantity: sdk.toHumanString(quantity, baseDecimals), actualCost: sdk.toHumanString(cost, quoteDecimals), entryProbability: Number(costNumerator) / Number(quantity * scale) * 100 }
}

export async function publishCall({ marketId, outcome, amount }) {
  const currentExchange = await getExchange()
  if (!walletAddress) throw new Error('Connect your wallet before publishing a Call.')
  const requestedAmount = Number(amount)
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) throw new Error('Enter an amount greater than zero.')
  const market = await currentExchange.client.getBinaryMarket(marketId)
  if (!market) throw new Error('That live window is no longer available.')
  const onchainBeforeWrite = await currentExchange.client.getMarketOnchain(market.marketId)
  if (onchainBeforeWrite.status !== 1 || onchainBeforeWrite.isResolved || onchainBeforeWrite.isVoided) throw new Error('That window has closed. Refresh the live markets and choose another one.')
  const unifiedMarkets = await currentExchange.loadMarkets(true)
  const unifiedMarket = Object.values(unifiedMarkets).find((candidate) => candidate.info.marketType === 'BINARY' && candidate.info.marketId.toLowerCase() === market.marketId.toLowerCase())
  if (!unifiedMarket) throw new Error('The live market could not be prepared for a wallet write.')
  const selectedOutcome = unifiedMarket.outcomes?.find((candidate) => candidate.index === outcome)
  if (!selectedOutcome) throw new Error('Choose a valid side for this market.')
  if (unifiedMarket.limits.amount.min !== undefined && requestedAmount < unifiedMarket.limits.amount.min) throw new Error(`The minimum position size is ${unifiedMarket.limits.amount.min} contracts.`)
  const book = await getBinaryBook(market)
  const asks = outcome === 0 ? book.yesAsks : book.noAsks
  if (!asks?.[0]) throw new Error('There is no available offer on that side right now. Refresh and try again.')
  const order = await currentExchange.createOrder(selectedOutcome.symbol, 'market', 'buy', requestedAmount, undefined, { slippage: 0.02 })
  const info = order.info && typeof order.info === 'object' ? order.info : null
  const receipt = info?.receipt
  if (!receipt || receipt.status !== 'success') throw new Error('The transaction did not confirm successfully. No Call was created.')
  const fills = Array.isArray(info.fills) ? info.fills : []
  const summary = rawFillSummary(fills, outcome, market.quoteDecimals, market.baseDecimals)
  if (!summary) throw new Error('The transaction confirmed with zero fill. No Call was created.')
  return { market, marketId: market.marketId, outcome, outcomeLabel: selectedOutcome.label, transactionHash: receipt.transactionHash || info.hash, ...summary }
}

export async function persistCall(call) {
  if (!walletAddress) throw new Error('Connect your wallet before saving a public Call.')
  const response = await fetch('/api/calls', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ marketId: call.marketId || call.market.marketId, transactionHash: call.transactionHash, walletAddress }) })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'The confirmed Call could not be saved to the public record.')
  return body
}

export async function getPublicCall(id, includeProof = false) {
  const query = includeProof ? '?proof=1' : ''
  const response = await fetch(`/api/calls/${encodeURIComponent(id)}${query}`)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'The public Call could not be found.')
  return body
}

export async function getPublicProfile(address) {
  const response = await fetch(`/api/profile/${encodeURIComponent(address)}`)
  const body = await response.json().catch(() => ({}))
  if (response.status === 404) return { walletAddress: address, settledCalls: 0, accuracy: null, calls: [] }
  if (!response.ok) throw new Error(body.error || 'The public Velo record could not be loaded.')
  return body
}

export async function getClaimablePositions(address) {
  const response = await fetch(`/api/claimable/${encodeURIComponent(address)}`)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Claimable positions could not be loaded.')
  return body.positions || []
}

export async function redeemClaimablePosition(position) {
  const currentExchange = await getExchange()
  if (!walletAddress) throw new Error('Connect the wallet that owns this position first.')
  const onchain = await currentExchange.client.getMarketOnchain(position.marketId)
  if (!onchain?.isResolved && !onchain?.isVoided) throw new Error('This market is not ready to claim yet.')
  const outcomeIdx = position.outcome === 'No' ? 1 : 0
  const expectedWinner = Number(onchain.winningOutcome) === 0 ? 0 : 1
  if (!onchain.isVoided && outcomeIdx !== expectedWinner) throw new Error('This position did not win and has no payout to claim.')
  const result = await currentExchange.trader.redeem({ marketId: position.marketId, market: onchain.marketAddress, outcomeToken: onchain.outcomeToken, outcomeIdx, amount: BigInt(position.amountRaw) })
  if (result.receipt?.status === 'reverted') throw new Error('The claim transaction reverted.')
  return result
}
