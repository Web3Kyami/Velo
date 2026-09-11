import './product.css'
import {
  connectWallet,
  getBinaryBook,
  getConnectedWallet,
  listVerifiedLiveMarkets,
  networkLabel,
  probabilityPercent,
  persistCall,
  publishCall,
} from './dreamdex.js'

const icon = '<span class="arrow" aria-hidden="true">↗</span>'
const escapeHTML = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
const formatProbability = (value) => value === null ? 'No trade yet' : `${value.toFixed(1)}%`
const formatTimeRemaining = (expiry) => {
  const seconds = Math.max(0, Number(expiry) - Math.floor(Date.now() / 1000))
  if (seconds <= 0) return 'Window closed'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m left` : `${minutes}m ${String(seconds % 60).padStart(2, '0')}s left`
}
const shortAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`

document.body.className = 'product-body'
document.querySelector('#app').innerHTML = `
  <header class="app-header">
    <a class="logo" href="/"><span class="logo-mark">v</span><span>velo</span></a>
    <nav aria-label="Product navigation"><a class="nav-link nav-link--active" href="/app">Live calls</a><a class="my-velo-link" href="#my-velo">My Velo</a></nav>
    <button class="button button--light button--small connect-trigger" type="button">Connect wallet</button>
  </header>

  <main class="product-shell">
    <section class="product-intro"><div><p class="kicker"><span class="kicker-dot"></span> ${escapeHTML(networkLabel)} / Live windows</p><h1>What do you<br /><i>see?</i></h1></div><div class="product-intro__aside"><p>Choose a live window, take a side, and publish the call you are willing to stand behind.</p><span class="product-intro__rule"></span></div></section>
    <section class="markets-section" aria-labelledby="markets-title">
      <div class="section-bar"><div><p class="kicker">Open now</p><h2 id="markets-title">Live windows</h2></div><button class="button button--outline refresh-trigger" type="button">Refresh ${icon}</button></div>
      <div class="market-panel" id="live-panel"><div class="loading-state"><span class="loading-pulse"></span><p>Reading live windows</p><span>Only open windows appear here.</span></div></div>
      <div class="call-launcher" id="call-launcher" hidden></div>
    </section>
    <section class="product-note" id="my-velo"><span class="product-note__mark">v</span><div><p class="kicker">Your record</p><h2>Make one worth checking.</h2><p>Connect your wallet to open your public Velo record after your first confirmed Call.</p></div><button class="button button--outline connect-trigger" type="button">Connect wallet ${icon}</button></section>
  </main>
  <footer class="app-footer"><a class="logo" href="/"><span class="logo-mark">v</span><span>velo</span></a><span>Make the call. Keep the receipt.</span></footer>
  <div class="toast" role="status" aria-live="polite" aria-hidden="true"><strong class="toast__title">Wallet</strong><span class="toast__message"></span><button class="toast__close" type="button" aria-label="Close message">×</button></div>
`

const toast = document.querySelector('.toast')
let toastTimer
const showToast = (title, message) => {
  document.querySelector('.toast__title').textContent = title
  document.querySelector('.toast__message').textContent = message
  toast.classList.add('toast--visible')
  toast.setAttribute('aria-hidden', 'false')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.classList.remove('toast--visible'); toast.setAttribute('aria-hidden', 'true') }, 6000)
}

let currentLiveMarkets = []
let selectedMarketId = null
const renderMarketRow = ({ market, book }) => {
  const current = probabilityPercent(market.lastPrice, market.quoteDecimals)
  const yesAsk = book?.yesAsks?.[0] ? probabilityPercent(book.yesAsks[0].price, market.quoteDecimals) : null
  const noAsk = book?.noAsks?.[0] ? probabilityPercent(book.noAsks[0].price, market.quoteDecimals) : null
  return `<article class="market-row"><div class="market-row__top"><span class="market-asset">${escapeHTML(market.asset)}</span><span class="market-window">${escapeHTML(market.interval || 'Live window')}</span></div><h3>${escapeHTML(market.question)}</h3><div class="market-row__details"><div><span>Current probability</span><strong>${formatProbability(current)}</strong></div><div><span>Higher offer</span><strong>${formatProbability(yesAsk)}</strong></div><div><span>Lower offer</span><strong>${formatProbability(noAsk)}</strong></div><div><span>Time remaining</span><strong>${formatTimeRemaining(market.expiry)}</strong></div></div><button class="market-select" type="button" data-market-id="${escapeHTML(market.marketId)}">Make this Call ${icon}</button></article>`
}
const setPanelMessage = (title, message, status = 'Unavailable') => {
  document.querySelector('#live-panel').innerHTML = `<div class="panel-message"><span class="panel-message__status">${escapeHTML(status)}</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(message)}</p><button class="button button--outline refresh-trigger" type="button">Try again ${icon}</button></div>`
  document.querySelector('.refresh-trigger').addEventListener('click', loadLiveMarkets)
}
const loadLiveMarkets = async (event) => {
  const button = event?.currentTarget
  if (button) { button.disabled = true; button.textContent = 'Reading windows' }
  try {
    const verified = await listVerifiedLiveMarkets()
    const withBooks = await Promise.all(verified.map(async (entry) => { try { return { ...entry, book: await getBinaryBook(entry.market) } } catch { return { ...entry, book: null } } }))
    currentLiveMarkets = withBooks
    if (!withBooks.length) { setPanelMessage('No live windows right now.', 'There are no open windows to choose from. Check back when the next one is available.', 'No open windows'); return }
    document.querySelector('#live-panel').innerHTML = `<div class="market-panel__header"><span>${withBooks.length} live ${withBooks.length === 1 ? 'window' : 'windows'}</span><span>Updated just now</span></div><div class="market-list">${withBooks.slice(0, 12).map(renderMarketRow).join('')}</div>`
  } catch (error) {
    setPanelMessage('Live windows are unavailable.', error instanceof Error ? error.message : 'The live source could not be reached. Nothing is shown as current until it can be checked.', 'Read failed')
  } finally {
    if (button) { button.disabled = false; button.innerHTML = `Refresh ${icon}` }
  }
}
const renderConfirmedCall = ({ market, outcomeLabel, filledQuantity, actualCost, entryProbability, transactionHash, publicCallId }) => `<div class="call-success"><span class="kicker"><span class="kicker-dot"></span> Call confirmed</span><h3>Your call is ready to share.</h3><p>${escapeHTML(filledQuantity)} contracts of ${escapeHTML(outcomeLabel)} filled at ${formatProbability(entryProbability)}. Actual cost: ${escapeHTML(actualCost)}.</p><div class="call-success__actions">${publicCallId ? `<a class="button button--dark" href="/call/${encodeURIComponent(publicCallId)}">Open public Call ${icon}</a>` : ''}<a class="text-link" href="https://shannon-explorer.somnia.network/tx/${encodeURIComponent(transactionHash)}" target="_blank" rel="noreferrer">View proof ${icon}</a></div></div>`
const openCallLauncher = (marketId) => {
  const entry = currentLiveMarkets.find(({ market }) => market.marketId === marketId)
  if (!entry) return
  selectedMarketId = marketId
  const { market, book } = entry
  const yesAsk = book?.yesAsks?.[0] ? probabilityPercent(book.yesAsks[0].price, market.quoteDecimals) : null
  const noAsk = book?.noAsks?.[0] ? probabilityPercent(book.noAsks[0].price, market.quoteDecimals) : null
  const launcher = document.querySelector('#call-launcher')
  launcher.hidden = false
  launcher.innerHTML = `<div class="launcher-header"><div><p class="kicker"><span class="kicker-dot"></span> New Call</p><h2>${escapeHTML(market.asset)} / ${escapeHTML(market.interval || 'Live window')}</h2><p>${escapeHTML(market.question)}</p></div><button class="launcher-close" type="button" aria-label="Close Call form">×</button></div><form class="call-form" id="call-form"><fieldset><legend>Choose your side</legend><div class="side-options"><label class="side-option"><input type="radio" name="outcome" value="0" checked /><span>Higher</span><small>${formatProbability(yesAsk)} offer</small></label><label class="side-option"><input type="radio" name="outcome" value="1" /><span>Lower</span><small>${formatProbability(noAsk)} offer</small></label></div></fieldset><label class="amount-field"><span>Amount in contracts</span><input type="number" name="amount" min="0" step="any" inputmode="decimal" placeholder="Enter an amount" required /><small>Only what fills becomes a public Call.</small></label><div class="call-summary"><span>Time remaining</span><strong>${formatTimeRemaining(market.expiry)}</strong></div><button class="button button--dark" type="submit">Publish Call ${icon}</button><p class="call-form__note">Your wallet confirms the transaction. Your Call is created after a confirmed fill.</p></form>`
  launcher.scrollIntoView({ behavior: 'smooth', block: 'center' })
  launcher.querySelector('.launcher-close').addEventListener('click', () => { launcher.hidden = true; launcher.innerHTML = ''; selectedMarketId = null })
  launcher.querySelector('#call-form').addEventListener('submit', handleCallSubmit)
}
const handleCallSubmit = async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  const submitButton = form.querySelector('button[type="submit"]')
  if (!getConnectedWallet()) { showToast('Connect wallet first', `Connect a wallet on ${networkLabel} before publishing a Call.`); return }
  submitButton.disabled = true; submitButton.textContent = 'Confirming transaction'
  try {
    const data = new FormData(form)
    const result = await publishCall({ marketId: selectedMarketId, outcome: Number(data.get('outcome')), amount: data.get('amount') })
    submitButton.textContent = 'Saving public record'
    try {
      const record = await persistCall(result)
      document.querySelector('#call-launcher').innerHTML = renderConfirmedCall({ ...result, publicCallId: record.id })
      showToast('Call published', 'Your public Call is ready to share.')
    } catch (error) {
      document.querySelector('#call-launcher').innerHTML = renderConfirmedCall(result) + `<p class="save-warning">The fill is confirmed, but the public record could not be saved yet. Keep the proof link and try again from the same wallet.</p>`
      showToast('Record pending', error instanceof Error ? error.message : 'The confirmed Call could not be saved.')
    }
  } catch (error) {
    showToast('Call not created', error instanceof Error ? error.message : 'The transaction could not be confirmed. No Call was created.')
    submitButton.disabled = false; submitButton.textContent = `Publish Call ${icon}`
  }
}
const handleWalletConnect = async (event) => {
  const button = event.currentTarget
  const original = button.textContent
  button.disabled = true; button.textContent = 'Connecting'
  try {
    const address = await connectWallet()
    document.querySelectorAll('.connect-trigger').forEach((trigger) => { trigger.textContent = shortAddress(address); trigger.classList.add('is-connected') })
    document.querySelector('.my-velo-link').href = `/profile/${encodeURIComponent(address)}`
    showToast('Wallet connected', `${shortAddress(address)} is connected on ${networkLabel}.`)
  } catch (error) { showToast('Wallet not connected', error instanceof Error ? error.message : 'The wallet request could not be completed.')
  } finally { button.disabled = false; if (!document.querySelector('.is-connected')) button.textContent = original }
}
document.querySelectorAll('.connect-trigger').forEach((button) => button.addEventListener('click', handleWalletConnect))
document.querySelector('.refresh-trigger').addEventListener('click', loadLiveMarkets)
document.querySelector('#live-panel').addEventListener('click', (event) => { const button = event.target.closest('[data-market-id]'); if (button) openCallLauncher(button.dataset.marketId) })
document.querySelector('.my-velo-link').addEventListener('click', (event) => { if (!getConnectedWallet()) { event.preventDefault(); showToast('Connect wallet first', 'Your public record is linked to the wallet you connect here.') } })
document.querySelector('.toast__close').addEventListener('click', () => { toast.classList.remove('toast--visible'); toast.setAttribute('aria-hidden', 'true') })
loadLiveMarkets()
