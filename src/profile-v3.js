import './profile-v3.css'
import {
  collateralDecimals,
  collateralSymbol,
  connectWallet,
  getClaimablePositions,
  getConnectedWallet,
  getPublicProfile,
  redeemClaimablePosition,
} from './dreamdex.js'

const address = window.location.pathname.match(/^\/profile\/(0x[a-f0-9]{40})$/i)?.[1]
const escapeHTML = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
const shortAddress = (value) => `${value.slice(0, 6)}...${value.slice(-4)}`
const formatProbability = (value) => value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`
const sideLabel = (side) => String(side).toLowerCase() === 'yes' ? 'Higher' : 'Lower'
const normalizeInterval = (value) => String(value || 'Live').toUpperCase().replace(/\s+/g, '')
const secondsLeft = (expiry) => Math.max(0, Number(expiry) - Math.floor(Date.now() / 1000))
const formatTime = (expiry) => {
  const seconds = secondsLeft(expiry)
  if (seconds <= 0) return 'Closed'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
const formatCollateralRaw = (raw) => {
  try {
    const value = BigInt(raw || '0')
    const scale = 10n ** BigInt(collateralDecimals)
    const whole = value / scale
    const fraction = value % scale
    const decimals = fraction.toString().padStart(collateralDecimals, '0').replace(/0+$/, '').slice(0, 2)
    return `${whole.toString()}${decimals ? `.${decimals}` : ''} ${collateralSymbol}`
  } catch {
    return `0 ${collateralSymbol}`
  }
}

const icons = {
  market: '<svg viewBox="0 0 24 24"><path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/></svg>',
  profile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-4 3.3-6 7-6s6.3 2 7 6"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>',
  receipt: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
  stack: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></svg>',
}

const assetIcon = (asset) => {
  if (asset === 'BTC') return '<span class="p-asset p-asset--btc">₿</span>'
  if (asset === 'ETH') return '<span class="p-asset p-asset--eth"><svg viewBox="0 0 32 32"><path d="M16 3 8.5 16 16 20.2 23.5 16 16 3Z" fill="currentColor" stroke="none"/><path d="m8.5 17.5 7.5 11 7.5-11-7.5 4.2-7.5-4.2Z" fill="currentColor" stroke="none"/></svg></span>'
  return `<span class="p-asset">${escapeHTML(String(asset).slice(0, 1))}</span>`
}

let claimable = []
let profile
let toastTimer

document.body.className = 'profile-body-v3'
document.title = 'Profile | Velo'

const toast = document.createElement('div')
toast.className = 'profile-toast'
document.body.append(toast)
const showToast = (title, message) => {
  toast.innerHTML = `<strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span>`
  toast.classList.add('is-visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4800)
}

const renderTop = () => `
  <header class="profile-nav-v3">
    <a class="profile-brand-v3" href="/"><span>v</span><b>velo</b></a>
    <nav><a href="/app">${icons.market}<span>Markets</span></a><a class="is-active" href="${window.location.pathname}">${icons.profile}<span>Profile</span></a></nav>
    <span class="profile-wallet-v3"><i></i>${escapeHTML(shortAddress(address))}</span>
  </header>`

const avatarStyle = () => {
  const hue = parseInt(address.slice(2, 8), 16) % 360
  const hue2 = (hue + 55) % 360
  return `--avatar-a:hsl(${hue} 72% 55%);--avatar-b:hsl(${hue2} 76% 42%)`
}

const renderLiveCard = (call) => `
  <a class="live-call-card" href="/call/${encodeURIComponent(call.id)}">
    <div class="live-call-card__top"><div>${assetIcon(call.asset)}<strong>${escapeHTML(call.asset)}</strong><span>${escapeHTML(normalizeInterval(call.interval))}</span></div><em><i></i>Open</em></div>
    <p>${escapeHTML(call.question)}</p>
    <div class="live-call-card__bottom">
      <div class="call-side call-side--${call.outcome === 'Yes' ? 'higher' : 'lower'}"><span>${sideLabel(call.outcome)}</span><strong>${formatProbability(call.entryProbability)}</strong></div>
      <div class="call-time">${icons.clock}<span><small>Closes in</small><strong data-expiry="${escapeHTML(call.expiry)}">${formatTime(call.expiry)}</strong></span></div>
      <div class="call-cost"><span>Cost</span><strong>${escapeHTML(call.actualCost)} ${collateralSymbol}</strong></div>
    </div>
  </a>`

const renderReceiptRow = (call) => `
  <a class="receipt-row" href="/call/${encodeURIComponent(call.id)}">
    <span>${escapeHTML(new Date(call.createdAt).toLocaleDateString())}</span>
    <div>${assetIcon(call.asset)}<strong>${escapeHTML(call.asset)}</strong><small>${escapeHTML(normalizeInterval(call.interval))}</small></div>
    <span class="receipt-side receipt-side--${call.outcome === 'Yes' ? 'higher' : 'lower'}">${sideLabel(call.outcome)}</span>
    <span>${formatProbability(call.entryProbability)}</span>
    <b class="receipt-result receipt-result--${String(call.result || 'void').toLowerCase()}">${escapeHTML(call.result || 'Void')}</b>
    <span>${escapeHTML(call.actualCost)} ${collateralSymbol}</span>
  </a>`

const renderClaimableList = () => {
  if (!claimable.length) return '<div class="claim-empty">No winnings waiting to be claimed.</div>'
  return claimable.map((position, index) => `<div class="claim-item"><div><strong>${position.outcome === 'Yes' ? 'Higher' : 'Lower'} position</strong><span>${escapeHTML(position.marketId.slice(0, 10))}...${escapeHTML(position.marketId.slice(-6))}</span></div><span>${formatCollateralRaw(position.estimatedPayoutRaw)}</span><button data-claim="${index}" type="button">Claim</button></div>`).join('')
}

const renderProfile = () => {
  const calls = profile.calls || []
  const live = calls.filter((call) => call.state === 'Live' && !call.result)
  const receipts = calls.filter((call) => call.result || call.state !== 'Live')
  const accuracy = profile.accuracy === null ? '—' : `${profile.accuracy.toFixed(1)}%`
  const totalClaimable = claimable.reduce((sum, position) => sum + BigInt(position.estimatedPayoutRaw || '0'), 0n)

  document.querySelector('#app').innerHTML = `
    ${renderTop()}
    <main class="profile-shell-v3">
      <section class="profile-title-v3"><h1>Profile</h1><p>Your record. Your Calls. Onchain.</p></section>

      <section class="profile-overview-v3">
        <article class="identity-card-v3">
          <div class="address-avatar-v3" style="${avatarStyle()}"><span></span></div>
          <div class="identity-copy-v3"><div><strong>${escapeHTML(shortAddress(profile.walletAddress))}</strong><button class="copy-address" type="button" aria-label="Copy wallet address">${icons.copy}</button></div><span>Wallet profile</span><small>${escapeHTML(profile.walletAddress)}</small></div>
        </article>

        <article class="record-card-v3">
          <div class="record-card-v3__heading"><h2>Your record</h2><p>Real Calls. Real outcomes.</p></div>
          <div class="record-stats-v3">
            <div><span class="stat-icon">${icons.receipt}</span><small>Public Calls</small><strong>${calls.length}</strong></div>
            <div><span class="stat-icon">${icons.target}</span><small>Accuracy</small><strong>${accuracy}</strong></div>
            <div><span class="stat-icon">${icons.market}</span><small>Live Calls</small><strong>${live.length}</strong></div>
            <div><span class="stat-icon">${icons.receipt}</span><small>Settled Receipts</small><strong>${profile.settledCalls}</strong></div>
            <div class="claim-stat"><span class="stat-icon">${icons.stack}</span><small>Claimable</small><strong>${formatCollateralRaw(totalClaimable.toString())}</strong>${claimable.length ? '<button class="scroll-claim" type="button">Claim winnings</button>' : '<span class="nothing-due">Nothing due</span>'}</div>
          </div>
        </article>
      </section>

      <section class="profile-section-card-v3">
        <div class="section-head-v3"><div><h2>Live Calls</h2><p>Your active positions, in real time.</p></div><a href="/app">${icons.plus}<span>Make a new Call</span></a></div>
        <div class="live-calls-grid-v3">${live.length ? live.map(renderLiveCard).join('') : '<div class="profile-empty-card-v3"><strong>No live Calls yet.</strong><span>Open a market and publish your first Call.</span><a href="/app">Explore markets</a></div>'}</div>
      </section>

      <section class="profile-lower-v3">
        <article class="profile-section-card-v3 receipt-section-v3">
          <div class="section-head-v3"><div><h2>Settled Receipts</h2><p>Your recent Calls and results.</p></div></div>
          ${receipts.length ? `<div class="receipt-head"><span>Date</span><span>Market</span><span>Side</span><span>Entry</span><span>Outcome</span><span>Cost</span></div><div class="receipt-list-v3">${receipts.map(renderReceiptRow).join('')}</div>` : '<div class="profile-empty-card-v3"><strong>No receipts yet.</strong><span>Your completed Calls will stay here.</span></div>'}
        </article>

        <aside class="claim-card-v3" id="claim-section">
          <div class="section-head-v3"><div><h2>Claimable winnings</h2><p>Resolved positions ready for redemption.</p></div></div>
          <div class="claim-list-v3">${renderClaimableList()}</div>
        </aside>
      </section>
    </main>`

  document.querySelector('.copy-address').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(profile.walletAddress); showToast('Copied', 'Wallet address copied.') }
    catch { showToast('Copy unavailable', 'Copy the address from the page.') }
  })
  document.querySelector('.scroll-claim')?.addEventListener('click', () => document.querySelector('#claim-section').scrollIntoView({ behavior: 'smooth', block: 'center' }))
  document.querySelectorAll('[data-claim]').forEach((button) => button.addEventListener('click', () => claimPosition(Number(button.dataset.claim), button)))
  tickTimers()
}

const tickTimers = () => {
  document.querySelectorAll('[data-expiry]').forEach((node) => { node.textContent = formatTime(node.dataset.expiry) })
}

const claimPosition = async (index, button) => {
  const position = claimable[index]
  button.disabled = true
  button.textContent = 'Connect'
  try {
    let connected = getConnectedWallet()
    if (!connected) connected = await connectWallet()
    if (connected.toLowerCase() !== address.toLowerCase()) throw new Error(`Connect ${shortAddress(address)} to claim this position.`)
    button.textContent = 'Confirm'
    await redeemClaimablePosition(position)
    button.textContent = 'Claimed'
    showToast('Claim submitted', 'Your redemption transaction was submitted.')
  } catch (error) {
    button.disabled = false
    button.textContent = 'Claim'
    showToast('Claim unavailable', error instanceof Error ? error.message : 'This position could not be claimed.')
  }
}

const load = async () => {
  if (!address) {
    document.querySelector('#app').innerHTML = '<main class="profile-error-v3"><h1>Profile unavailable</h1><a href="/app">Back to Markets</a></main>'
    return
  }
  document.querySelector('#app').innerHTML = '<div class="profile-loading-v3">Loading profile</div>'
  try {
    ;[profile, claimable] = await Promise.all([getPublicProfile(address), getClaimablePositions(address).catch(() => [])])
    renderProfile()
    window.setInterval(tickTimers, 1000)
  } catch (error) {
    document.querySelector('#app').innerHTML = `${renderTop()}<main class="profile-error-v3"><h1>Could not load this profile.</h1><p>${escapeHTML(error instanceof Error ? error.message : 'Try again shortly.')}</p><a href="/app">Back to Markets</a></main>`
  }
}

load()
