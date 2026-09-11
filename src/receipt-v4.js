import './receipt-v4.css'
import {
  collateralSymbol,
  connectWallet,
  getBinaryBook,
  getPublicCall,
  listVerifiedLiveMarkets,
  persistCall,
  probabilityPercent,
  publishCall,
} from './dreamdex.js'
import { getProfileMetadata } from './profile-meta.js'

const callId = window.location.pathname.match(/^\/call\/([a-f0-9]{24})$/i)?.[1]
const escapeHTML = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
const shortAddress = (value) => `${value.slice(0, 6)}...${value.slice(-4)}`
const sideLabel = (side) => String(side).toLowerCase() === 'yes' ? 'Higher' : 'Lower'
const formatProbability = (value) => value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`
const secondsLeft = (expiry) => Math.max(0, Number(expiry) - Math.floor(Date.now() / 1000))
const formatTime = (expiry) => {
  const seconds = secondsLeft(expiry)
  if (seconds <= 0) return 'Closed'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

const icons = {
  share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/></svg>',
  proof: '<svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.7 2.9 8.2 7 10 4.1-1.8 7-5.3 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>',
}

let call
let proof
let trader
let backingEntry
let toastTimer

document.body.className = 'receipt-body-v4'
document.title = 'Call | Velo'

const toast = document.createElement('div')
toast.className = 'receipt-toast'
document.body.append(toast)
const showToast = (title, message) => {
  toast.innerHTML = `<strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span>`
  toast.classList.add('is-visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4500)
}

const assetIcon = (asset) => asset === 'BTC'
  ? '<span class="receipt-asset receipt-asset--btc">₿</span>'
  : '<span class="receipt-asset receipt-asset--eth"><svg viewBox="0 0 32 32"><path d="M16 3 8.5 16 16 20.2 23.5 16 16 3Z" fill="currentColor" stroke="none"/><path d="m8.5 17.5 7.5 11 7.5-11-7.5 4.2-7.5-4.2Z" fill="currentColor" stroke="none"/></svg></span>'

const statusLabel = () => call.result || call.state || 'Live'
const statusClass = () => String(statusLabel()).toLowerCase().replace(/\s+/g, '-')

const render = () => {
  const displayName = trader?.displayName || shortAddress(proof.proof.walletAddress)
  const live = Boolean(call.backing?.available)
  const side = sideLabel(call.outcome)
  document.title = `${displayName} · ${call.asset} ${side} | Velo`
  document.querySelector('#app').innerHTML = `
    <header class="receipt-nav-v4">
      <a class="receipt-brand-v4" href="/"><span>v</span><b>velo</b></a>
      <nav><a href="/app">Markets</a><a href="/profile/${encodeURIComponent(proof.proof.walletAddress)}">Profile</a></nav>
      <a class="receipt-open-app" href="/app">Open Velo</a>
    </header>

    <main class="receipt-shell-v4">
      <section class="receipt-title-v4"><span>${live ? 'Live Call' : 'Verified Receipt'}</span><h1>${live ? 'This call is still live.' : 'The result is on the record.'}</h1></section>

      <article class="hero-receipt-v4 hero-receipt--${statusClass()}">
        <div class="receipt-topline-v4">
          <div class="trader-chip-v4"><div class="trader-avatar-v4">${escapeHTML(displayName.slice(0, 1).toUpperCase())}</div><div><strong>${escapeHTML(displayName)}</strong><a href="/profile/${encodeURIComponent(proof.proof.walletAddress)}">${escapeHTML(shortAddress(proof.proof.walletAddress))}</a></div></div>
          <span class="receipt-status-v4"><i></i>${escapeHTML(statusLabel())}</span>
        </div>

        <div class="receipt-main-v4">
          <div class="receipt-market-v4">${assetIcon(call.asset)}<div><strong>${escapeHTML(call.asset)}</strong><span>${escapeHTML(String(call.interval || 'Live').toUpperCase())}</span></div></div>
          <p>${escapeHTML(call.question)}</p>
          <div class="receipt-position-v4">
            <span class="position-side-v4 position-side--${side.toLowerCase()}">${side}</span>
            <strong>${formatProbability(call.entryProbability)}</strong>
            <small>entry probability</small>
          </div>
        </div>

        <div class="receipt-metrics-v4">
          <div><span>Position cost</span><strong>${escapeHTML(call.actualCost)} ${collateralSymbol}</strong></div>
          <div><span>Filled</span><strong>${escapeHTML(call.filledQuantity)}</strong></div>
          <div><span>${live ? 'Closes in' : 'Outcome'}</span><strong ${live ? `data-expiry="${escapeHTML(call.expiry)}"` : ''}>${live ? formatTime(call.expiry) : escapeHTML(call.result || 'Settled')}</strong></div>
          <div><span>Published</span><strong>${escapeHTML(new Date(call.createdAt).toLocaleDateString())}</strong></div>
        </div>
      </article>

      <div class="receipt-actions-v4">
        ${live ? '<button class="receipt-primary back-call-trigger" type="button">Back this Call</button>' : '<a class="receipt-primary" href="/app">Open current markets</a>'}
        <button class="receipt-secondary share-trigger" type="button">${icons.share}<span>Share</span></button>
        <button class="receipt-secondary copy-trigger" type="button">${icons.copy}<span>Copy link</span></button>
        <button class="receipt-secondary proof-trigger" type="button">${icons.proof}<span>View proof</span></button>
      </div>

      <section class="receipt-context-v4">
        <article><span>Trader</span><strong>${escapeHTML(displayName)}</strong><a href="/profile/${encodeURIComponent(proof.proof.walletAddress)}">View full profile</a></article>
        <article><span>Verification</span><strong>Confirmed Velo Call</strong><small>Created from a verified DreamDEX fill.</small></article>
        <article><span>Identity</span><strong>${escapeHTML(shortAddress(proof.proof.walletAddress))}</strong><small>The wallet remains the source identity.</small></article>
      </section>

      <section id="back-panel-v4"></section>
      <section id="proof-panel-v4" hidden></section>
    </main>`

  document.querySelector('.share-trigger').addEventListener('click', shareCall)
  document.querySelector('.copy-trigger').addEventListener('click', copyCall)
  document.querySelector('.proof-trigger').addEventListener('click', showProof)
  document.querySelector('.back-call-trigger')?.addEventListener('click', openBackPanel)
  tick()
}

const shareCall = async () => {
  const url = window.location.href
  const text = `${trader?.displayName || shortAddress(proof.proof.walletAddress)} called ${call.asset} ${sideLabel(call.outcome)}.`
  if (navigator.share) return navigator.share({ title: document.title, text, url }).catch(() => {})
  return copyCall()
}

const copyCall = async () => {
  try { await navigator.clipboard.writeText(window.location.href); showToast('Copied', 'Public Call link copied.') }
  catch { showToast('Copy unavailable', 'Copy the URL from your browser.') }
}

const showProof = () => {
  const panel = document.querySelector('#proof-panel-v4')
  panel.hidden = false
  panel.innerHTML = `<div class="proof-card-v4"><div><span>Transaction</span><a href="${escapeHTML(proof.proof.url)}" target="_blank" rel="noreferrer">${escapeHTML(proof.proof.transactionHash.slice(0, 12))}...${escapeHTML(proof.proof.transactionHash.slice(-8))}</a></div><div><span>Market ID</span><strong>${escapeHTML(proof.proof.marketId.slice(0, 12))}...${escapeHTML(proof.proof.marketId.slice(-8))}</strong></div><div><span>Fill block</span><strong>${escapeHTML(proof.proof.fillBlockNumber)}</strong></div><div><span>Verified</span><strong>${escapeHTML(new Date(proof.proof.verifiedAt).toLocaleString())}</strong></div></div>`
  document.querySelector('.proof-trigger').remove()
}

const quote = (entry, outcome) => {
  const level = outcome === 0 ? entry?.book?.yesAsks?.[0] : entry?.book?.noAsks?.[0]
  return level ? probabilityPercent(level.price, entry.market.quoteDecimals) : null
}
const estimatedContracts = (stake, probability) => {
  const value = Number(stake)
  const price = Number(probability) / 100
  return Number.isFinite(value) && value > 0 && price > 0 ? value / price : null
}

const openBackPanel = async () => {
  const trigger = document.querySelector('.back-call-trigger')
  trigger.disabled = true
  trigger.textContent = 'Loading market'
  try {
    const entries = await listVerifiedLiveMarkets()
    backingEntry = entries.find(({ market }) => market.marketId.toLowerCase() === call.backing.key.toLowerCase())
    if (!backingEntry) throw new Error('This market is no longer open.')
    backingEntry.book = await getBinaryBook(backingEntry.market)
    const yes = quote(backingEntry, 0)
    const no = quote(backingEntry, 1)
    const originalOutcome = call.outcome === 'Yes' ? 0 : 1
    const panel = document.querySelector('#back-panel-v4')
    panel.innerHTML = `<div class="back-card-v4"><div class="back-heading-v4"><span>Back this Call</span><h2>Take your own position</h2><p>Your entry uses the price available now.</p></div><form id="back-form-v4"><div class="back-sides-v4"><label><input type="radio" name="outcome" value="0" ${originalOutcome === 0 ? 'checked' : ''} ${yes === null ? 'disabled' : ''}><span>Higher</span><strong>${formatProbability(yes)}</strong></label><label><input type="radio" name="outcome" value="1" ${originalOutcome === 1 ? 'checked' : ''} ${no === null ? 'disabled' : ''}><span>Lower</span><strong>${formatProbability(no)}</strong></label></div><label class="back-stake-v4"><span>Stake in ${collateralSymbol}</span><input name="stake" type="number" min="0" step="any" placeholder="0.00" required></label><button type="submit">Publish my Call</button></form></div>`
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' })
    document.querySelector('#back-form-v4').addEventListener('submit', submitBack)
    trigger.remove()
  } catch (error) {
    trigger.disabled = false
    trigger.textContent = 'Back this Call'
    showToast('Backing unavailable', error instanceof Error ? error.message : 'Try again shortly.')
  }
}

const submitBack = async (event) => {
  event.preventDefault()
  const button = event.currentTarget.querySelector('button[type="submit"]')
  const data = new FormData(event.currentTarget)
  const outcome = Number(data.get('outcome'))
  const stake = Number(data.get('stake'))
  const probability = quote(backingEntry, outcome)
  const amount = estimatedContracts(stake, probability)
  if (!amount) return showToast('Enter a valid stake', 'Choose a side with a live quote and enter an amount.')
  button.disabled = true
  button.textContent = 'Connect wallet'
  try {
    await connectWallet()
    button.textContent = 'Confirm in wallet'
    const result = await publishCall({ marketId: backingEntry.market.marketId, outcome, amount: Number(amount.toFixed(8)) })
    button.textContent = 'Saving Call'
    const record = await persistCall(result)
    window.location.href = `/call/${encodeURIComponent(record.id)}`
  } catch (error) {
    button.disabled = false
    button.textContent = 'Publish my Call'
    showToast('Call not created', error instanceof Error ? error.message : 'The transaction could not be completed.')
  }
}

const tick = () => document.querySelectorAll('[data-expiry]').forEach((node) => { node.textContent = formatTime(node.dataset.expiry) })

const load = async () => {
  if (!callId) return
  document.querySelector('#app').innerHTML = '<div class="receipt-loading-v4">Loading Call</div>'
  try {
    proof = await getPublicCall(callId, true)
    call = proof
    trader = await getProfileMetadata(proof.proof.walletAddress).catch(() => ({ displayName: null }))
    render()
    window.setInterval(tick, 1000)
  } catch (error) {
    document.querySelector('#app').innerHTML = `<main class="receipt-error-v4"><h1>Call unavailable</h1><p>${escapeHTML(error instanceof Error ? error.message : 'This Call could not be loaded.')}</p><a href="/app">Back to Markets</a></main>`
  }
}

load()
