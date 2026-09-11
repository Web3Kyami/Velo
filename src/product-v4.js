import './product-v4.css'
import {
  collateralSymbol,
  connectWallet,
  getBinaryBook,
  getConnectedWallet,
  getPublicProfile,
  listVerifiedLiveMarkets,
  persistCall,
  probabilityPercent,
  publishCall,
} from './dreamdex.js'
import { getMarketProbabilitySeries, sparklineMarkup } from './market-charts.js'

const escapeHTML = (value) => String(value ?? '').replace(/[&<>'\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' })[character])
const shortAddress = (value) => `${value.slice(0, 6)}...${value.slice(-4)}`
const normalizeInterval = (value) => String(value || 'Live').toUpperCase().replace(/\s+/g, '')
const secondsLeft = (expiry) => Math.max(0, Number(expiry) - Math.floor(Date.now() / 1000))
const formatTime = (expiry) => {
  const seconds = secondsLeft(expiry)
  if (seconds <= 0) return 'Closed'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}
const formatProbability = (value) => value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`
const sideLabel = (outcome) => Number(outcome) === 0 || outcome === 'Yes' ? 'Higher' : 'Lower'

const icons = {
  market: '<svg viewBox="0 0 24 24"><path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/></svg>',
  profile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-4 3.3-6 7-6s6.3 2 7 6"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
  wallet: '<svg viewBox="0 0 24 24"><path d="M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h12"/><path d="M16 12h4v4h-4a2 2 0 0 1 0-4z"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 20V5M6.5 10.5L12 5l5.5 5.5"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 4v15M6.5 13.5L12 19l5.5-5.5"/></svg>',
  activity: '<svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
}

const assetIcon = (asset) => asset === 'BTC'
  ? '<span class="asset-icon asset-icon--btc">₿</span>'
  : asset === 'ETH'
    ? '<span class="asset-icon asset-icon--eth"><svg viewBox="0 0 32 32"><path d="M16 3 8.5 16 16 20.2 23.5 16 16 3Z" fill="currentColor" stroke="none"/><path d="m8.5 17.5 7.5 11 7.5-11-7.5 4.2-7.5-4.2Z" fill="currentColor" stroke="none"/></svg></span>'
    : `<span class="asset-icon">${escapeHTML(String(asset).slice(0, 1))}</span>`

let markets = []
let selectedMarketId = null
let assetFilter = 'ALL'
let intervalFilter = 'ALL'
let openOnly = false
let viewMode = 'grid'
let timerHandle
let toastTimer

const app = document.querySelector('#app')
document.body.className = 'product-body product-body-v4'
document.title = 'Markets | Velo'

app.innerHTML = `
  <header class="app-nav app-nav-v4">
    <a class="velo-brand" href="/"><span class="old-velo-mark">v</span><span>velo</span></a>
    <nav class="primary-nav"><a class="primary-nav__item is-active" href="/app">${icons.market}<span>Markets</span></a><button class="primary-nav__item profile-trigger" type="button">${icons.profile}<span>Profile</span></button></nav>
    <button class="wallet-pill connect-trigger" type="button">${icons.wallet}<span class="wallet-label">Connect wallet</span><span class="wallet-status"></span></button>
  </header>

  <main class="app-shell app-shell-v4">
    <section class="markets-heading"><div><h1>Live Markets</h1><p>Choose a market, pick a side, and make your call.</p></div></section>
    <div class="market-workspace-v4">
      <section class="markets-column-v4">
        <div class="market-toolbar-v4">
          <div class="select-control-v4"><select id="asset-select"><option value="ALL">All markets</option><option value="BTC">Bitcoin</option><option value="ETH">Ethereum</option></select></div>
          <div class="select-control-v4"><select id="interval-select"><option value="ALL">All windows</option></select></div>
          <label class="open-toggle-v4"><span>Open only</span><input id="open-only" type="checkbox"><i><b></b></i></label>
          <div class="view-toggle view-toggle-v4"><button class="view-button is-active" data-view="grid" type="button">${icons.grid}<span>Card view</span></button><button class="view-button" data-view="list" type="button">${icons.list}<span>List view</span></button></div>
        </div>
        <div id="market-surface" class="market-surface market-surface--grid"><div class="loading-state"><span class="loading-orb"></span><strong>Loading live markets</strong><span>Reading current windows.</span></div></div>
      </section>

      <aside class="market-rail-v4">
        <article class="rail-panel-v4"><div class="rail-heading-v4"><div>${icons.clock}<h2>Recent Calls</h2></div><button class="profile-link profile-trigger" type="button">View all</button></div><div id="recent-calls" class="rail-list-v4"><div class="rail-empty-v4">Connect your wallet to see your Calls.</div></div></article>
        <article class="rail-panel-v4"><div class="rail-heading-v4"><div>${icons.activity}<h2>Your activity</h2></div><select aria-label="Activity period"><option>Last 7 days</option><option>Last 30 days</option></select></div><div id="activity-summary" class="activity-empty-v4"><span>${icons.activity}</span><strong>No activity yet</strong><p>Your Calls and results will appear here.</p><button class="explore-trigger" type="button">Explore Markets</button></div></article>
      </aside>
    </div>
  </main>

  <div class="trade-modal" id="trade-modal" hidden><button class="trade-backdrop modal-close" type="button" aria-label="Close trade"></button><section class="trade-dialog trade-dialog-v4" role="dialog" aria-modal="true"><button class="trade-close modal-close" type="button">×</button><div id="trade-content"></div></section></div>
  <div class="toast"><strong class="toast-title"></strong><span class="toast-message"></span></div>`

const modal = document.querySelector('#trade-modal')
const tradeContent = document.querySelector('#trade-content')
const toast = document.querySelector('.toast')
const showToast = (title, message) => {
  document.querySelector('.toast-title').textContent = title
  document.querySelector('.toast-message').textContent = message
  toast.classList.add('is-visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4800)
}

const quote = (entry, outcome) => {
  const level = outcome === 0 ? entry?.book?.yesAsks?.[0] : entry?.book?.noAsks?.[0]
  return level ? probabilityPercent(level.price, entry.market.quoteDecimals) : null
}
const tradable = (entry) => quote(entry, 0) !== null || quote(entry, 1) !== null
const selectedEntry = () => markets.find(({ market }) => market.marketId === selectedMarketId)

const cardMarkup = (entry) => {
  const { market, series } = entry
  const yes = quote(entry, 0)
  const no = quote(entry, 1)
  const open = tradable(entry)
  return `<article class="market-card market-card-v4 ${open ? '' : 'market-card--waiting'}">
    <div class="market-card__top"><div class="asset-line">${assetIcon(market.asset)}<strong>${escapeHTML(market.asset)}</strong><span class="interval-badge">${escapeHTML(normalizeInterval(market.interval))}</span></div>${sparklineMarkup(series, 'card-sparkline-v4', 210, 42)}<span class="market-status ${open ? 'market-status--open' : 'market-status--waiting'}"><i></i>${open ? 'Open' : 'Waiting'}</span></div>
    <p class="market-question">${escapeHTML(market.question)}</p>
    ${open ? `<div class="market-card__footer"><div class="probability-box probability-box--higher"><span>${icons.up}<em>Higher</em></span><strong>${formatProbability(yes)}</strong></div><div class="probability-box probability-box--lower"><span>${icons.down}<em>Lower</em></span><strong>${formatProbability(no)}</strong></div><div class="market-timer">${icons.clock}<span><em>Closes in</em><strong data-expiry="${escapeHTML(market.expiry)}">${formatTime(market.expiry)}</strong></span></div><button class="open-call" data-open-market="${escapeHTML(market.marketId)}" type="button">Open Call</button></div>` : `<div class="waiting-row"><span>⌛</span><div><strong>Market not yet available</strong><span>Quotes will appear closer to start time.</span></div><div class="market-timer">${icons.clock}<span><em>Closes in</em><strong data-expiry="${escapeHTML(market.expiry)}">${formatTime(market.expiry)}</strong></span></div></div>`}
  </article>`
}

const listMarkup = (entry) => {
  const { market } = entry
  const yes = quote(entry, 0)
  const no = quote(entry, 1)
  return `<article class="market-list-row"><div class="list-market"><div class="asset-line">${assetIcon(market.asset)}<strong>${escapeHTML(market.asset)}</strong><span class="interval-badge">${escapeHTML(normalizeInterval(market.interval))}</span></div><p>${escapeHTML(market.question)}</p></div><div class="list-price list-price--higher"><span>Higher</span><strong>${formatProbability(yes)}</strong></div><div class="list-price list-price--lower"><span>Lower</span><strong>${formatProbability(no)}</strong></div><div class="market-timer">${icons.clock}<span><em>Closes in</em><strong data-expiry="${escapeHTML(market.expiry)}">${formatTime(market.expiry)}</strong></span></div><button class="open-call" data-open-market="${escapeHTML(market.marketId)}" type="button" ${tradable(entry) ? '' : 'disabled'}>${tradable(entry) ? 'Open Call' : 'Waiting'}</button></article>`
}

const visibleMarkets = () => markets.filter((entry) => {
  const assetOk = assetFilter === 'ALL' || entry.market.asset === assetFilter
  const intervalOk = intervalFilter === 'ALL' || normalizeInterval(entry.market.interval) === intervalFilter
  return assetOk && intervalOk && (!openOnly || tradable(entry))
})

const renderMarkets = () => {
  const surface = document.querySelector('#market-surface')
  const entries = visibleMarkets()
  surface.className = `market-surface market-surface--${viewMode}`
  surface.innerHTML = entries.length ? entries.map(viewMode === 'grid' ? cardMarkup : listMarkup).join('') : '<div class="empty-market-state"><strong>No markets match these filters.</strong><span>Try another asset or window.</span></div>'
  tick()
}

const populateIntervals = () => {
  const select = document.querySelector('#interval-select')
  const intervals = [...new Set(markets.map(({ market }) => normalizeInterval(market.interval)).filter(Boolean))]
  const rank = { '1M': 1, '5M': 5, '15M': 15, '1H': 60, '4H': 240, '1D': 1440, '3D': 4320 }
  intervals.sort((a, b) => (rank[a] ?? 99999) - (rank[b] ?? 99999))
  select.innerHTML = '<option value="ALL">All windows</option>' + intervals.map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('')
  select.value = intervals.includes(intervalFilter) ? intervalFilter : 'ALL'
}

const loadMarkets = async () => {
  try {
    const live = await listVerifiedLiveMarkets()
    markets = await Promise.all(live.filter(({ market }) => secondsLeft(market.expiry) > 0).map(async (entry) => {
      const [book, series] = await Promise.all([getBinaryBook(entry.market).catch(() => null), getMarketProbabilitySeries(entry.market).catch(() => [])])
      return { ...entry, book, series }
    }))
    markets.sort((a, b) => Number(a.market.expiry) - Number(b.market.expiry))
    populateIntervals()
    renderMarkets()
    clearInterval(timerHandle)
    timerHandle = setInterval(tick, 1000)
  } catch (error) {
    document.querySelector('#market-surface').innerHTML = `<div class="empty-market-state"><strong>Markets unavailable.</strong><span>${escapeHTML(error instanceof Error ? error.message : 'Try again shortly.')}</span></div>`
  }
}

const tick = () => document.querySelectorAll('[data-expiry]').forEach((node) => { node.textContent = formatTime(node.dataset.expiry) })

const updateWalletUI = (address) => {
  document.querySelector('.wallet-label').textContent = shortAddress(address)
  document.querySelector('.wallet-pill').classList.add('is-connected')
  localStorage.setItem('velo:lastWallet', address)
}

const ensureWallet = async () => {
  if (getConnectedWallet()) return getConnectedWallet()
  const address = await connectWallet()
  updateWalletUI(address)
  await loadActivity(address)
  return address
}

const renderActivity = (profile) => {
  const recent = (profile.calls || []).slice(0, 4)
  const recentNode = document.querySelector('#recent-calls')
  recentNode.innerHTML = recent.length ? recent.map((call) => `<a class="rail-call-row-v4" href="/call/${encodeURIComponent(call.id)}"><div>${assetIcon(call.asset)}<span><strong>${escapeHTML(call.asset)} ${escapeHTML(normalizeInterval(call.interval))}</strong><small>${sideLabel(call.outcome)} · ${formatProbability(call.entryProbability)}</small></span></div><b class="rail-result rail-result--${String(call.result || call.state).toLowerCase()}">${escapeHTML(call.result || call.state)}</b></a>`).join('') : '<div class="rail-empty-v4">No Calls yet. Your first confirmed Call will appear here.</div>'
  const live = profile.calls.filter((call) => call.state === 'Live' && !call.result).length
  const settled = profile.settledCalls || 0
  document.querySelector('#activity-summary').innerHTML = `<div class="activity-stats-v4"><div><span>Calls</span><strong>${profile.calls.length}</strong></div><div><span>Live</span><strong>${live}</strong></div><div><span>Settled</span><strong>${settled}</strong></div><div><span>Accuracy</span><strong>${profile.accuracy === null ? '—' : `${profile.accuracy.toFixed(1)}%`}</strong></div></div><button class="open-profile-v4" type="button">Open Profile</button>`
  document.querySelector('.open-profile-v4').addEventListener('click', openProfile)
}

const loadActivity = async (address) => {
  try { renderActivity(await getPublicProfile(address)) }
  catch { document.querySelector('#recent-calls').innerHTML = '<div class="rail-empty-v4">Your record will appear after your first confirmed Call.</div>' }
}

const remembered = localStorage.getItem('velo:lastWallet')
if (remembered && /^0x[a-f0-9]{40}$/i.test(remembered)) {
  document.querySelector('.wallet-label').textContent = shortAddress(remembered)
  document.querySelector('.wallet-pill').classList.add('is-known')
  loadActivity(remembered)
}

const estimatedContracts = (stake, probability) => {
  const value = Number(stake)
  const price = Number(probability) / 100
  return Number.isFinite(value) && value > 0 && price > 0 ? value / price : null
}

const renderTrade = (entry) => {
  const yes = quote(entry, 0)
  const no = quote(entry, 1)
  const higherDefault = yes !== null || no === null
  return `<div class="trade-market-head"><div class="asset-line">${assetIcon(entry.market.asset)}<strong>${escapeHTML(entry.market.asset)}</strong><span class="interval-badge">${escapeHTML(normalizeInterval(entry.market.interval))}</span></div><div class="trade-countdown">${icons.clock}<span><em>Closes in</em><strong data-expiry="${escapeHTML(entry.market.expiry)}">${formatTime(entry.market.expiry)}</strong></span></div></div><h2>${escapeHTML(entry.market.question)}</h2>${sparklineMarkup(entry.series, 'modal-sparkline-v4', 520, 72)}<form id="trade-form" class="trade-form"><fieldset class="side-fieldset"><legend>Choose your side</legend><div class="side-choice-grid"><label class="side-choice side-choice--higher"><input type="radio" name="outcome" value="0" ${higherDefault ? 'checked' : ''} ${yes === null ? 'disabled' : ''}><span>${icons.up}<em>Higher</em></span><strong>${formatProbability(yes)}</strong><small>Implied probability</small></label><label class="side-choice side-choice--lower"><input type="radio" name="outcome" value="1" ${higherDefault ? '' : 'checked'} ${no === null ? 'disabled' : ''}><span>${icons.down}<em>Lower</em></span><strong>${formatProbability(no)}</strong><small>Implied probability</small></label></div></fieldset><div class="stake-section"><div class="stake-heading"><strong>Your stake</strong><span>${collateralSymbol}</span></div><div class="stake-input"><span>${collateralSymbol}</span><input name="stake" type="number" min="0" step="any" placeholder="0.00" required></div><div class="stake-presets"><button type="button" data-stake="5">5</button><button type="button" data-stake="10">10</button><button type="button" data-stake="25">25</button><button type="button" data-stake="50">50</button></div><div class="collateral-note">${icons.wallet}<span>Stake is paid in <strong>${collateralSymbol}</strong>. STT is used only for gas.</span></div></div><div class="estimate-panel"><strong>Estimated position</strong><div><span>Expected contracts</span><b data-estimate="contracts">—</b></div><div><span>Estimated payout if correct</span><b data-estimate="payout">—</b></div><div><span>Estimated profit</span><b class="positive" data-estimate="profit">—</b></div></div><button class="publish-call" type="submit">Publish Call</button><button class="cancel-call close-inline" type="button">Cancel</button></form>`
}

const updateEstimate = () => {
  const form = document.querySelector('#trade-form')
  if (!form) return
  const entry = selectedEntry()
  const data = new FormData(form)
  const probability = quote(entry, Number(data.get('outcome')))
  const stake = Number(form.querySelector('[name="stake"]').value)
  const contracts = estimatedContracts(stake, probability)
  form.querySelector('[data-estimate="contracts"]').textContent = contracts ? `≈ ${contracts.toFixed(2)}` : '—'
  form.querySelector('[data-estimate="payout"]').textContent = contracts ? `≈ ${contracts.toFixed(2)} ${collateralSymbol}` : '—'
  form.querySelector('[data-estimate="profit"]').textContent = contracts ? `≈ ${(contracts - stake).toFixed(2)} ${collateralSymbol}` : '—'
}

const openTrade = (id) => {
  const entry = markets.find(({ market }) => market.marketId === id)
  if (!entry || !tradable(entry)) return
  selectedMarketId = id
  tradeContent.innerHTML = renderTrade(entry)
  modal.hidden = false
  document.body.classList.add('modal-open')
  const form = document.querySelector('#trade-form')
  form.addEventListener('change', updateEstimate)
  form.querySelector('[name="stake"]').addEventListener('input', updateEstimate)
  form.querySelectorAll('[data-stake]').forEach((button) => button.addEventListener('click', () => { form.querySelector('[name="stake"]').value = button.dataset.stake; updateEstimate() }))
  form.querySelector('.close-inline').addEventListener('click', closeTrade)
  form.addEventListener('submit', submitCall)
  tick()
}
const closeTrade = () => { modal.hidden = true; document.body.classList.remove('modal-open'); selectedMarketId = null; tradeContent.innerHTML = '' }

const submitCall = async (event) => {
  event.preventDefault()
  const entry = selectedEntry()
  const form = event.currentTarget
  const button = form.querySelector('[type="submit"]')
  const data = new FormData(form)
  const outcome = Number(data.get('outcome'))
  const stake = Number(data.get('stake'))
  const amount = estimatedContracts(stake, quote(entry, outcome))
  if (!amount) return showToast('Enter a valid stake', `Choose a live side and enter ${collateralSymbol}.`)
  button.disabled = true
  button.textContent = 'Preparing wallet'
  try {
    await ensureWallet()
    button.textContent = 'Confirm in wallet'
    const result = await publishCall({ marketId: selectedMarketId, outcome, amount: Number(amount.toFixed(8)) })
    button.textContent = 'Saving Call'
    const record = await persistCall(result)
    tradeContent.innerHTML = `<div class="success-panel"><span class="success-orb">✓</span><p>Call published</p><h2>${escapeHTML(result.market.asset)} ${sideLabel(result.outcome)}</h2><span>Your position filled at ${formatProbability(result.entryProbability)}.</span><a class="publish-call" href="/call/${encodeURIComponent(record.id)}">View Call</a></div>`
    loadActivity(getConnectedWallet())
  } catch (error) {
    button.disabled = false
    button.textContent = 'Publish Call'
    showToast('Call not created', error instanceof Error ? error.message : 'The transaction could not be completed.')
  }
}

const openProfile = async () => {
  const address = getConnectedWallet() || localStorage.getItem('velo:lastWallet')
  if (address) return window.location.href = `/profile/${encodeURIComponent(address)}`
  try { window.location.href = `/profile/${encodeURIComponent(await ensureWallet())}` }
  catch (error) { showToast('Connect wallet', error instanceof Error ? error.message : 'Connect your wallet to open Profile.') }
}

document.querySelector('#asset-select').addEventListener('change', (event) => { assetFilter = event.target.value; renderMarkets() })
document.querySelector('#interval-select').addEventListener('change', (event) => { intervalFilter = event.target.value; renderMarkets() })
document.querySelector('#open-only').addEventListener('change', (event) => { openOnly = event.target.checked; renderMarkets() })
document.querySelector('.view-toggle-v4').addEventListener('click', (event) => { const button = event.target.closest('[data-view]'); if (!button) return; viewMode = button.dataset.view; document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('is-active', item === button)); renderMarkets() })
document.querySelector('#market-surface').addEventListener('click', (event) => { const button = event.target.closest('[data-open-market]'); if (button && !button.disabled) openTrade(button.dataset.openMarket) })
document.querySelectorAll('.modal-close').forEach((button) => button.addEventListener('click', closeTrade))
document.querySelector('.connect-trigger').addEventListener('click', async () => { try { await ensureWallet() } catch (error) { showToast('Wallet not connected', error instanceof Error ? error.message : 'Try again.') } })
document.querySelectorAll('.profile-trigger').forEach((button) => button.addEventListener('click', openProfile))
document.querySelector('.explore-trigger').addEventListener('click', () => document.querySelector('.markets-column-v4').scrollIntoView({ behavior: 'smooth' }))
window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.hidden) closeTrade() })

loadMarkets()
