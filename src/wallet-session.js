import { restoreWallet, warmOrderMarkets } from './dreamdex.js'

export async function restoreSession() {
  const address = await restoreWallet().catch(() => null)
  if (address) localStorage.setItem('velo:lastWallet', address)
  return address
}

export function warmTradeSession() {
  warmOrderMarkets().catch(() => {})
}
