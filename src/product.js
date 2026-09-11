import './product.css'
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
  restoreWallet,
} from './dreamdex.js'

const escapeHTML = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[character])
const shortAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`
const formatProbability = (value) => value === null || value === undefined ? null : `${Number(value).toFixed(1)}%`
const secondsLeft = (expiry) => Math.max(0, Number(expiry) - Math.floor(Date.now() / 1000))
const formatTimeRemaining = (expiry) => {
  const seconds = secondsLeft(expiry)
  if (seconds <= 0) return 'Closed'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}
const normalizeInterval = (value) => String(value || '').toUpperCase().replace(/\s+/g, '')
const displaySide = (value) => Number(value) === 0 || value === 'Yes' ? 'Higher' : 'Lower'
const resultClass = (value) => String(value || 'Live').toLowerCase().replace(/\s+/g, '-')

const icons = {
  market: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/></svg>',
  profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-4 3.3-6 7-6s6.3 2 7 6"/></svg>',
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h12"/><path d="M16 12h4v4h-4a2 2 0 0 1 0-4z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4 4 4-4"/></svg>',
  arrowUp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5M6.5 10.5L12 5l5.5 5.5"/></svg>',
  arrowDown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M6.5 13.5L12 19l5.5-5.5"/></svg>',
}

const btcIcon = '<span class="asset-icon asset-icon--btc" aria-hidden="true">₿</span>'
const ethIcon = '<span class="asset-icon asset-icon--eth" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 3 8.5 16 16 20.2 23.5 16 16 3Z" fill="currentColor" stroke="none"/><path d="m8.5 17.5 7.5 11 7.5-11-7.5 4.2-7.5-4.2Z" fill="currentColor" stroke="none"/></svg></span>'
const assetIcon = (asset) => asset === 'BTC' ? btcIcon : asset === 'ETH' ? ethIcon : `<span class="asset-icon">${escapeHTML(String(asset).slice(0, 1))}</span>`

let currentLiveMarkets = []
let selectedMarketId = null
let timerHandle
let toastTimer
let filters = { asset: 'ALL', interval: 'ALL', tradableOnly: false }
let viewMode = 'grid'

const app = document.querySelector('#app')
document.body.className = 'product-body'
document.title = 'Markets | Velo'

app.innerHTML = `
  <header class="app-nav">
    <a class="velo-brand" href="/" aria-label="Velo home"><span class="velo-mark">v</span><span>velo</span></a>
    <nav class="primary-nav" aria-label="Primary navigation">
      <a class="primary-nav__item is-active" href="/app">${icons.market}<span>Markets</span></a>
      <button class="primary-nav__item profile-trigger" type="button">${icons.profile}<span>Profile</span></button>
    </nav>
    <button class="wallet-pill connect-trigger" type="button">${icons.wallet}<span class="wallet-status"></span><span class="wallet-label">Connect wallet</span>${icons.chevron}</button>
  </header>

  <main class="app-shell">
    <section class="markets-heading">
      <div><h1>Live Markets</h1><p>Choose a market, pick a side, and make your call.</p></div>
    </section>

    <section class="market-controls" aria-label="Market filters">
      <div class="asset-tabs" id="asset-filters">
        <button class="filter-chip is-active" data-filter-asset="ALL" type="button">All markets</button>
        <button class="filter-chip" data-filter-asset="BTC" type="button">${btcIcon}<span>BTC</span></button>
        <button class="filter-chip" data-filter-asset="ETH" type="button">${ethIcon}<span>ETH</span></button>
      </div>
      <label class="window-filter"><span>Window</span><select id="interval-select"><option value="ALL">All windows</option></select></label>
      <label class="switch-control"><span>Tradable only</span><input id="tradable-toggle" type="checkbox"><span class="switch-track"><span></span></span></label>
      <div class="view-toggle" aria-label="View mode">
        <button class="view-button is-active" data-view="grid" type="button">${icons.grid}<span>Cards</span></button>
        <button class="view-button" data-view="list" type="button">${icons.list}<span>List</span></button>
      </div>
    </section>

    <div class="dashboard-layout">
      <section class="market-column">
        <section id="market-surface" class="market-surface market-surface--grid" aria-live="polite">
          <div class="loading-state"><span class="loading-orb"></span><strong>Loading live markets</strong><span>Reading current DreamDEX windows.</span></div>
        </section>
      </section>

      <aside class="activity-rail">
        <article class="activity-panel">
          <div class="panel-heading"><div><span class="panel-icon">${icons.clock}</span><h2>Recent Calls</h2></div><button class="profile-link profile-trigger" type="button">View all</button></div>
          <div id="recent-calls" class="recent-calls"><div class="quiet-state">Connect your wallet to see your recent Calls.</div></div>
        </article>
        <article class="activity-panel activity-panel--compact">
          <div class="panel-heading"><div><span class="panel-icon">${icons.profile}</span><h2>Your activity</h2></div></div>
          <div id="activity-summary" class="activity-empty"><span class="activity-empty__icon">${icons.profile}</span><strong>No activity yet</strong><p>Your Calls and results will appear here once you start trading.</p><button class="activity-action" type="button">Explore Markets</button></div>
        </article>
      </aside>
    </div>
  </main>

  <div class="trade-modal" id="trade-modal" hidden>
    <button class="trade-backdrop modal-close" aria-label="Close trade" type="button"></button>
    <section class="trade-dialog" role="dialog" aria-modal="true" aria-labelledby="trade-title"><button class="trade-close modal-close" type="button" aria-label="Close trade">×</button><div id="trade-content"></div></section>
  </div>
  <div class="toast" role="status" aria-live="polite" aria-hidden="true"><strong class="toast-title"></strong><span class="toast-message"></span></div>
`

const modal = document.querySelector('#trade-modal')
const tradeContent = document.querySelector('#trade-content')
const toast = document.querySelector('.toast')

const showToast = (title, message) => {
  document.querySelector('.toast-title').textContent = title
  document.querySelector('.toast-message').textContent = message
  toast.classList.add('is-visible')
  toast.setAttribute('aria-hidden', 'false')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.classList.remove('is-visible'); toast.setAttribute('aria-hidden', 'true') }, 5200)
}

const marketQuote = (entry, outcome) => {
  const level = outcome === 0 ? entry?.book?.yesAsks?.[0] : entry?.book?.noAsks?.[0]
  return level ? probabilityPercent(level.price, entry.market.quoteDecimals) : null
}
const hasAnyQuote = (entry) => marketQuote(entry, 0) !== null || marketQuote(entry, 1) !== null
const selectedEntry = () => currentLiveMarkets.find(({ market }) => market.marketId === selectedMarketId)

const renderMarketCard = (entry) => {
  const { market } = entry
  const yes = marketQuote(entry, 0)
  const no = marketQuote(entry, 1)
  const tradable = yes !== null || no !== null
  const interval = normalizeInterval(market.interval || '') || 'LIVE'
  return `
    <article class="market-card ${tradable ? '' : 'market-card--waiting'}">
      <div class="market-card__top"><div class="asset-line">${assetIcon(market.asset)}<strong>${escapeHTML(market.asset)}</strong><span class="interval-badge">${escapeHTML(interval)}</span></div><span class="market-status ${tradable ? 'market-status--open' : 'market-status--waiting'}"><i></i>${tradable ? 'Open' : 'Waiting'}</span></div>
      <p class="market-question">${escapeHTML(market.question)}</p>
      ${tradable ? `
        <div class="market-card__footer">
          <div class="probability-box probability-box--higher"><span>${icons.arrowUp}<em>Higher</em></span><strong>${formatProbability(yes) || '—'}</strong></div>
          <div class="probability-box probability-box--lower"><span>${icons.arrowDown}<em>Lower</em></span><strong>${formatProbability(no) || '—'}</strong></div>
          <div class="market-timer">${icons.clock}<span><em>Closes in</em><strong data-expiry="${escapeHTML(market.expiry)}">${formatTimeRemaining(market.expiry)}</strong></span></div>
          <button class="open-call" data-open-market="${escapeHTML(market.marketId)}" type="button">Open Call</button>
        </div>
      ` : `<div class="waiting-row"><span class="waiting-symbol">⌛</span><div><strong>Quotes not available</strong><span>This window does not have a live offer yet.</span></div><div class="market-timer">${icons.clock}<span><em>Closes in</em><strong data-expiry="${escapeHTML(market.expiry)}">${formatTimeRemaining(market.expiry)}</strong></span></div></div>`}
    </article>`
}

const renderMarketListRow = (entry) => {
  const { market } = entry
  const yes = marketQuote(entry, 0)
  const no = marketQuote(entry, 1)
  const tradable = yes !== null || no !== null
  return `
    <article class="market-list-row">
      <div class="list-market"><div class="asset-line">${assetIcon(market.asset)}<strong>${escapeHTML(market.asset)}</strong><span class="interval-badge">${escapeHTML(normalizeInterval(market.interval) || 'LIVE')}</span></div><p>${escapeHTML(market.question)}</p></div>
      <div class="list-price list-price--higher"><span>Higher</span><strong>${formatProbability(yes) || '—'}</strong></div>
      <div class="list-price list-price--lower"><span>Lower</span><strong>${formatProbability(no) || '—'}</strong></div>
      <div class="market-timer">${icons.clock}<span><em>Closes in</em><strong data-expiry="${escapeHTML(market.expiry)}">${formatTimeRemaining(market.expiry)}</strong></span></div>
      <button class="open-call" data-open-market="${escapeHTML(market.marketId)}" type="button" ${tradable ? '' : 'disabled'}>${tradable ? 'Open Call' : 'Waiting'}</button>
    </article>`
}

const filteredMarkets = () => currentLiveMarkets.filter((entry) => {
  const assetMatch = filters.asset === 'ALL' || entry.market.asset === filters.asset
  const intervalMatch = filters.interval === 'ALL' || normalizeInterval(entry.market.interval) === filters.interval
  const quoteMatch = !filters.tradableOnly || hasAnyQuote(entry)
  return assetMatch && intervalMatch && quoteMatch
})

const tickCountdowns = () => {
  let needsRefresh = false
  document.querySelectorAll('[data-expiry]').forEach((element) => {
    const expiry = Number(element.dataset.expiry)
    element.textContent = formatTimeRemaining(expiry)
    if (secondsLeft(expiry) <= 0) needsRefresh = true
  })
  if (needsRefresh) setTimeout(() => loadLiveMarkets(), 1200)
}
const startCountdowns = () => { clearInterval(timerHandle); tickCountdowns(); timerHandle = setInterval(tickCountdowns, 1000) }

const renderMarkets = () => {
  const surface = document.querySelector('#market-surface')
  const entries = filteredMarkets()
  surface.className = `market-surface market-surface--${viewMode}`
  if (!entries.length) {
    surface.innerHTML = '<div class="empty-market-state"><strong>No markets match these filters.</strong><span>Try another asset, window, or turn off Tradable only.</span></div>'
    return
  }
  surface.innerHTML = entries.map(viewMode === 'grid' ? renderMarketCard : renderMarketListRow).join('')
  tickCountdowns()
}

const renderWindowSelect = () => {
  const intervals = [...new Set(currentLiveMarkets.map(({ market }) => normalizeInterval(market.interval)).filter(Boolean))]
  const toMinutes = (value) => {
    const match = value.match(/^(\d+)(M|H)$/)
    if (!match) return Number.MAX_SAFE_INTEGER
    return Number(match[1]) * (match[2] === 'H' ? 60 : 1)
  }
  intervals.sort((a, b) => toMinutes(a) - toMinutes(b))
  const select = document.querySelector('#interval-select')
  select.innerHTML = `<option value="ALL">All windows</option>${intervals.map((interval) => `<option value="${escapeHTML(interval)}">${escapeHTML(interval)}</option>`).join('')}`
  select.value = intervals.includes(filters.interval) ? filters.interval : 'ALL'
  filters.interval = select.value
}

const loadLiveMarkets = async () => {
  const surface = document.querySelector('#market-surface')
  try {
    const verified = await listVerifiedLiveMarkets()
    const withBooks = await Promise.all(verified.map(async (entry) => {
      try { return { ...entry, book: await getBinaryBook(entry.market) } }
      catch { return { ...entry, book: null } }
    }))
    currentLiveMarkets = withBooks.filter(({ market }) => secondsLeft(market.expiry) > 0).sort((a, b) => Number(a.market.expiry) - Number(b.market.expiry))
    renderWindowSelect()
    renderMarkets()
    startCountdowns()
  } catch (error) {
    surface.innerHTML = `<div class="empty-market-state"><strong>Markets are unavailable.</strong><span>${escapeHTML(error instanceof Error ? error.message : 'Try again shortly.')}</span><button class="activity-action retry-markets" type="button">Retry</button></div>`
    document.querySelector('.retry-markets')?.addEventListener('click', loadLiveMarkets)
  }
}

const updateWalletUI = (address) => {
  if (!address) return
  sessionStorage.setItem('velo:wallet', address)
  const button = document.querySelector('.wallet-pill')
  button.classList.add('is-connected')
  button.querySelector('.wallet-label').textContent = shortAddress(address)
}

const cachedAddress = () => sessionStorage.getItem('velo:wallet')

const ensureWallet = async () => {
  if (getConnectedWallet()) return getConnectedWallet()
  if (cachedAddress()) {
    const restored = await restoreWallet().catch(() => null)
    if (restored) { updateWalletUI(restored); return restored }
  }
  const address = await connectWallet()
  updateWalletUI(address)
  await loadProfileActivity(address)
  return address
}

const loadProfileActivity = async (address) => {
  if (!address) return
  try {
    const profile = await getPublicProfile(address)
    const recent = [...profile.calls].slice(0, 4)
    const recentPanel = document.querySelector('#recent-calls')
    const activityPanel = document.querySelector('#activity-summary')
    if (!recent.length) {
      recentPanel.innerHTML = '<div class="quiet-state">No Calls yet. Your first confirmed Call will appear here.</div>'
      activityPanel.innerHTML = `<span class="activity-empty__icon">${icons.profile}</span><strong>No activity yet</strong><p>Your Calls and results will appear here once you start trading.</p><button class="activity-action" type="button">Explore Markets</button>`
      activityPanel.querySelector('.activity-action')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
      return
    }
    recentPanel.innerHTML = recent.map((call) => `<a class="recent-row" href="/call/${encodeURIComponent(call.id)}"><div class="recent-row__market">${assetIcon(call.asset)}<span><b>${escapeHTML(call.asset)} ${escapeHTML(normalizeInterval(call.interval))}</b><small>${call.outcome === 'Yes' ? 'Higher' : 'Lower'} · ${formatProbability(call.entryProbability) || '—'}</small></span></div><span class="recent-result recent-result--${resultClass(call.result || call.state)}">${escapeHTML(call.result || call.state)}</span></a>`).join('')
    const settled = profile.calls.filter((call) => ['Won', 'Lost', 'Void'].includes(call.result)).length
    const live = profile.calls.filter((call) => call.state === 'Live').length
    activityPanel.innerHTML = `<div class="activity-numbers"><div><span>Calls</span><strong>${profile.calls.length}</strong></div><div><span>Live</span><strong>${live}</strong></div><div><span>Settled</span><strong>${settled}</strong></div><div><span>Accuracy</span><strong>${profile.accuracy === null ? '—' : `${profile.accuracy.toFixed(1)}%`}</strong></div></div><button class="activity-action profile-trigger" type="button">Open Profile</button>`
    activityPanel.querySelector('.profile-trigger')?.addEventListener('click', handleProfile)
  } catch {
    document.querySelector('#recent-calls').innerHTML = '<div class="quiet-state">Your Calls will appear here after your first confirmed position.</div>'
  }
}

const estimatedContracts = (stake, probability) => {
  const numericStake = Number(stake)
  const decimalPrice = Number(probability) / 100
  if (!Number.isFinite(numericStake) || numericStake <= 0 || !Number.isFinite(decimalPrice) || decimalPrice <= 0) return null
  return numericStake / decimalPrice
}

const updateTradeEstimate = () => {
  const form = document.querySelector('#trade-form')
  if (!form) return
  const entry = selectedEntry()
  const outcome = Number(new FormData(form).get('outcome') ?? 0)
  const stake = Number(form.querySelector('[name="stake"]').value)
  const probability = marketQuote(entry, outcome)
  const contracts = estimatedContracts(stake, probability)
  const payout = contracts
  const profit = contracts && Number.isFinite(stake) ? contracts - stake : null
  form.querySelector('[data-estimate="contracts"]').textContent = contracts ? `≈ ${contracts.toFixed(2)}` : '—'
  form.querySelector('[data-estimate="payout"]').textContent = payout ? `≈ ${payout.toFixed(2)} ${collateralSymbol}` : '—'
  form.querySelector('[data-estimate="profit"]').textContent = profit ? `≈ ${profit.toFixed(2)} ${collateralSymbol}` : '—'
}

const renderTradeForm = (entry) => {
  const { market } = entry
  const yes = marketQuote(entry, 0)
  const no = marketQuote(entry, 1)
  const higherDefault = yes !== null || no === null
  return `
    <div class="trade-market-head"><div class="asset-line">${assetIcon(market.asset)}<strong>${escapeHTML(market.asset)}</strong><span class="interval-badge">${escapeHTML(normalizeInterval(market.interval))}</span></div><div class="trade-countdown">${icons.clock}<span><em>Closes in</em><strong data-expiry="${escapeHTML(market.expiry)}">${formatTimeRemaining(market.expiry)}</strong></span></div></div>
    <h2 id="trade-title">${escapeHTML(market.question)}</h2>
    <form id="trade-form" class="trade-form">
      <fieldset class="side-fieldset"><legend>Choose your side</legend><div class="side-choice-grid">
        <label class="side-choice side-choice--higher"><input type="radio" name="outcome" value="0" ${higherDefault ? 'checked' : ''} ${yes === null ? 'disabled' : ''}><span>${icons.arrowUp}<em>Higher</em></span><strong>${formatProbability(yes) || '—'}</strong><small>Implied probability</small></label>
        <label class="side-choice side-choice--lower"><input type="radio" name="outcome" value="1" ${higherDefault ? '' : 'checked'} ${no === null ? 'disabled' : ''}><span>${icons.arrowDown}<em>Lower</em></span><strong>${formatProbability(no) || '—'}</strong><small>Implied probability</small></label>
      </div></fieldset>
      <div class="stake-section"><div class="stake-heading"><strong>Your stake</strong><span>${collateralSymbol}</span></div><div class="stake-input"><span>${collateralSymbol}</span><input name="stake" type="number" min="0" step="any" inputmode="decimal" placeholder="0.00" required></div><div class="stake-presets"><button type="button" data-stake="5">5</button><button type="button" data-stake="10">10</button><button type="button" data-stake="25">25</button><button type="button" data-stake="50">50</button></div><div class="collateral-note">${icons.wallet}<span>Stake is paid in <strong>${collateralSymbol}</strong>. STT is used only for gas.</span></div></div>
      <div class="estimate-panel"><strong>Estimated position</strong><div><span>Expected contracts</span><b data-estimate="contracts">—</b></div><div><span>Estimated payout if correct</span><b data-estimate="payout">—</b></div><div><span>Estimated profit</span><b class="positive" data-estimate="profit">—</b></div></div>
      <button class="publish-call" type="submit">Publish Call</button><button class="cancel-call modal-close-inline" type="button">Cancel</button>
    </form>`
}

const closeTrade = () => { modal.hidden = true; document.body.classList.remove('modal-open'); selectedMarketId = null; tradeContent.innerHTML = '' }
const openTrade = (marketId) => {
  const entry = currentLiveMarkets.find(({ market }) => market.marketId === marketId)
  if (!entry || !hasAnyQuote(entry)) return
  selectedMarketId = marketId
  tradeContent.innerHTML = renderTradeForm(entry)
  modal.hidden = false
  document.body.classList.add('modal-open')
  tickCountdowns()
  const form = document.querySelector('#trade-form')
  form.addEventListener('change', updateTradeEstimate)
  form.querySelector('[name="stake"]').addEventListener('input', updateTradeEstimate)
  form.querySelectorAll('[data-stake]').forEach((button) => button.addEventListener('click', () => {
    form.querySelector('[name="stake"]').value = button.dataset.stake
    form.querySelectorAll('[data-stake]').forEach((item) => item.classList.toggle('is-active', item === button))
    updateTradeEstimate()
  }))
  form.querySelector('.modal-close-inline').addEventListener('click', closeTrade)
  form.addEventListener('submit', handleCallSubmit)
}

const renderSuccess = (result, record) => {
  const side = displaySide(result.outcome)
  const url = `${window.location.origin}/call/${record.id}`
  tradeContent.innerHTML = `<div class="success-panel"><span class="success-orb">✓</span><p>Call published</p><h2>${escapeHTML(result.market.asset)} ${side}</h2><span>Your position filled at ${formatProbability(result.entryProbability)}.</span><div class="success-metrics"><div><em>Filled</em><strong>${escapeHTML(result.filledQuantity)}</strong></div><div><em>Cost</em><strong>${escapeHTML(result.actualCost)} ${collateralSymbol}</strong></div></div><a class="publish-call" href="/call/${encodeURIComponent(record.id)}">View Call</a><button class="share-success" type="button">Share Call</button></div>`
  document.querySelector('.share-success').addEventListener('click', async () => {
    if (navigator.share) await navigator.share({ title: `${result.market.asset} ${side} | Velo`, text: 'My Call is on the record.', url }).catch(() => {})
    else { try { await navigator.clipboard.writeText(url); showToast('Link copied', 'Your public Call is ready to share.') } catch { showToast('Share unavailable', 'Copy the Call URL from your browser.') } }
  })
}

async function handleCallSubmit(event) {
  event.preventDefault()
  const form = event.currentTarget
  const submit = form.querySelector('[type="submit"]')
  const entry = selectedEntry()
  const data = new FormData(form)
  const outcome = Number(data.get('outcome'))
  const stake = Number(data.get('stake'))
  const probability = marketQuote(entry, outcome)
  const amount = estimatedContracts(stake, probability)
  if (!Number.isFinite(stake) || stake <= 0) return showToast('Enter a stake', `Choose how much ${collateralSymbol} to put behind this Call.`)
  if (!amount) return showToast('No live offer', 'Choose a side with an available quote.')
  submit.disabled = true
  submit.textContent = 'Preparing wallet'
  try {
    await ensureWallet()
    submit.textContent = 'Confirm in wallet'
    const result = await publishCall({ marketId: selectedMarketId, outcome, amount: Number(amount.toFixed(8)) })
    submit.textContent = 'Saving Call'
    const record = await persistCall(result)
    renderSuccess(result, record)
    await loadProfileActivity(getConnectedWallet())
  } catch (error) {
    submit.disabled = false
    submit.textContent = 'Publish Call'
    showToast('Call not created', error instanceof Error ? error.message : 'The transaction could not be completed.')
  }
}

const handleWalletConnect = async () => {
  try {
    const address = await connectWallet()
    updateWalletUI(address)
    await loadProfileActivity(address)
  } catch (error) { showToast('Wallet not connected', error instanceof Error ? error.message : 'Connect a compatible wallet to continue.') }
}

const handleProfile = async () => {
  const cached = cachedAddress()
  if (cached) { window.location.href = `/profile/${encodeURIComponent(cached)}`; return }
  try {
    const address = await ensureWallet()
    window.location.href = `/profile/${encodeURIComponent(address)}`
  } catch (error) { showToast('Connect wallet', error instanceof Error ? error.message : 'Connect your wallet to open Profile.') }
}

document.querySelector('#asset-filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter-asset]')
  if (!button) return
  filters.asset = button.dataset.filterAsset
  document.querySelectorAll('[data-filter-asset]').forEach((item) => item.classList.toggle('is-active', item === button))
  renderMarkets()
})
document.querySelector('#interval-select').addEventListener('change', (event) => { filters.interval = event.target.value; renderMarkets() })
document.querySelector('#tradable-toggle').addEventListener('change', (event) => { filters.tradableOnly = event.target.checked; renderMarkets() })
document.querySelector('.view-toggle').addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]')
  if (!button) return
  viewMode = button.dataset.view
  document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('is-active', item === button))
  renderMarkets()
})
document.querySelector('#market-surface').addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-market]')
  if (button && !button.disabled) openTrade(button.dataset.openMarket)
})
document.querySelectorAll('.modal-close').forEach((button) => button.addEventListener('click', closeTrade))
document.querySelector('.connect-trigger').addEventListener('click', handleWalletConnect)
document.querySelectorAll('.profile-trigger').forEach((button) => button.addEventListener('click', handleProfile))
document.querySelector('.activity-action')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.hidden) closeTrade() })

const remembered = cachedAddress()
if (remembered) {
  updateWalletUI(remembered)
  loadProfileActivity(remembered)
}
loadLiveMarkets()
