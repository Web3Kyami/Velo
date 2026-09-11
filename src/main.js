import './styles.css'
import {
  connectWallet,
  getBinaryBook,
  getConnectedWallet,
  listVerifiedLiveMarkets,
  networkLabel,
  probabilityPercent,
  getPublicCall,
  getPublicProfile,
  persistCall,
  publishCall,
} from './dreamdex.js'

const icon = (name, className = '') => {
  const icons = {
    arrow: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h11M9.5 3.5 15 9l-5.5 5.5" /></svg>',
    link: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M7.2 10.8 10.8 7.2M5.1 12.9l-1.3 1.3a3 3 0 0 1-4.2-4.2l3.1-3.1a3 3 0 0 1 4.2 0M12.9 5.1l1.3-1.3a3 3 0 0 1 4.2 4.2l-3.1 3.1a3 3 0 0 1-4.2 0" /></svg>',
    lock: '<svg viewBox="0 0 18 18" aria-hidden="true"><rect x="3.5" y="7.5" width="11" height="8" rx="1" /><path d="M6 7.5V5.8a3 3 0 0 1 6 0v1.7" /></svg>',
    menu: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2 4.5h14M2 9h14M2 13.5h14" /></svg>',
    close: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="m4 4 10 10M14 4 4 14" /></svg>',
  }
  return `<span class="icon ${className}">${icons[name] || ''}</span>`
}

const callObject = ({ state = 'empty' } = {}) => {
  if (state === 'empty') {
    return `
      <article class="call-object call-object--empty" aria-label="Live Call waiting for a real market window">
        <div class="call-object__topline">
          <span class="eyebrow eyebrow--accent"><span class="signal-dot"></span> Live window</span>
          <span class="mono muted">Awaiting data</span>
        </div>
        <div class="call-object__empty-main">
          <div class="empty-mark" aria-hidden="true">+</div>
          <p class="call-object__empty-title">Your next call starts with a real window.</p>
          <p class="body-muted">Connect to DreamDEX to load the current Event Contract windows. Nothing is shown until live data is available.</p>
        </div>
        <div class="call-object__footer">
          <span class="mono muted">No call published</span>
          <span class="mono muted">No position recorded</span>
        </div>
      </article>
    `
  }

  return `
    <article class="call-object call-object--${state}">
      <div class="call-object__topline">
        <span class="eyebrow"><span class="status-square"></span>${state}</span>
        <span class="mono muted">Example anatomy</span>
      </div>
      <div class="call-object__subject">
        <span class="mono muted">ASSET / WINDOW</span>
        <strong>Market call</strong>
      </div>
      <div class="call-object__direction">HIGHER</div>
      <div class="call-object__metrics">
        <div><span class="mono muted">Entered</span><strong>Recorded at fill</strong></div>
        <div><span class="mono muted">Current</span><strong>Updated live</strong></div>
      </div>
      <div class="call-object__footer">
        <span class="mono muted">Confirmed fill required</span>
        <span class="mono muted">Window remains open</span>
      </div>
    </article>
  `
}

document.querySelector('#app').innerHTML = `
  <header class="site-header">
    <a class="wordmark" href="#top"><span class="wordmark__mark" aria-hidden="true">v</span>velo</a>
    <nav class="desktop-nav" aria-label="Primary navigation">
      <a href="#live">Live <span class="nav-signal"></span></a>
      <a href="#record">My Velo</a>
    </nav>
    <div class="header-actions">
      <button class="button button--quiet connect-trigger" type="button">Connect wallet</button>
      <button class="menu-trigger" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open navigation">${icon('menu')}</button>
    </div>
    <nav class="mobile-nav" id="mobile-menu" aria-label="Mobile navigation">
      <a href="#live">Live <span class="nav-signal"></span></a>
      <a href="#record">My Velo</a>
      <button class="button button--quiet connect-trigger" type="button">Connect wallet</button>
    </nav>
  </header>

  <main id="top">
    <section class="hero section-rule">
      <div class="hero__copy">
        <p class="eyebrow">A public record for live conviction</p>
        <h1>Your calls.<br /><em>On the record.</em></h1>
        <p class="hero__lede">Back a view with real money. Share it while it is live. Keep the receipt when it settles.</p>
        <div class="hero__actions">
          <a class="button button--primary" href="#live">Make a call ${icon('arrow')}</a>
          <a class="text-link" href="#anatomy">See how it works ${icon('arrow')}</a>
        </div>
        <div class="hero__note"><span class="mono">01</span><span>Every published Call begins with a confirmed fill.</span></div>
      </div>
      <div class="hero__visual">
        <div class="visual-caption"><span class="mono">VELO / LIVE OBJECT</span><span class="mono">01 / 03</span></div>
        <div id="hero-call-slot">${callObject()}</div>
        <p class="visual-footnote">The object renders only after the window is verified on-chain.</p>
      </div>
    </section>

    <section class="live-section content-grid section-rule" id="live">
      <div class="section-intro">
        <p class="eyebrow">01 / Live</p>
        <h2>Find the window<br /><em>worth backing.</em></h2>
        <p class="body-muted">Current windows come directly from DreamDEX. When the connection is ready, this is where you choose a market, set your side, and publish a live Call.</p>
        <button class="button button--outline refresh-trigger" type="button">Refresh live windows ${icon('arrow')}</button>
      </div>
      <div class="empty-panel" id="live-panel">
        <div class="empty-panel__head"><span class="mono">CURRENT WINDOWS</span><span class="mono status-copy"><span class="signal-dot"></span> Connection required</span></div>
        <div class="empty-panel__body">
          <div class="empty-panel__line"></div>
          <p class="empty-panel__title">Loading live windows.</p>
          <p class="body-muted">Reading current Event Contract windows from ${networkLabel}. The list will only show markets that are still Trading on-chain.</p>
        </div>
        <div class="empty-panel__footer"><span class="mono">Source: DreamDEX Event Contracts</span><span class="mono">Status: loading</span></div>
      </div>
      <div class="call-launcher" id="call-launcher" hidden></div>
    </section>

    <section class="anatomy section-rule" id="anatomy">
      <div class="anatomy__head">
        <p class="eyebrow">02 / The anatomy of a Call</p>
        <h2>Anyone can post a chart.<br /><em>Velo shows what they backed.</em></h2>
      </div>
      <div class="anatomy__body">
        <div class="anatomy__diagram">${callObject({ state: 'live' })}</div>
        <div class="anatomy__labels">
          <div class="anatomy-label"><span class="mono">01</span><div><strong>Real position</strong><p>Publishing follows a confirmed fill. Requested values never stand in for executed ones.</p></div></div>
          <div class="anatomy-label"><span class="mono">02</span><div><strong>Live context</strong><p>The original entry stays visible while the market window is open.</p></div></div>
          <div class="anatomy-label"><span class="mono">03</span><div><strong>Permanent receipt</strong><p>When reality resolves, this same object becomes a verified record.</p></div></div>
        </div>
      </div>
    </section>

    <section class="state-section section-rule">
      <div class="state-section__copy"><p class="eyebrow">03 / One object, three states</p><h2>The post changes<br /><em>when reality does.</em></h2><p class="body-muted">A Call keeps its history. It moves from live, to settling, to a receipt that can be checked.</p></div>
      <div class="state-track" aria-label="Call state progression">
        <div class="state-step state-step--active"><span class="state-step__number">01</span><strong>Live</strong><p>Open window<br />Entry recorded</p></div>
        <div class="state-connector" aria-hidden="true"></div>
        <div class="state-step"><span class="state-step__number">02</span><strong>Settling</strong><p>Writes closed<br />Result pending</p></div>
        <div class="state-connector" aria-hidden="true"></div>
        <div class="state-step"><span class="state-step__number">03</span><strong>Receipt</strong><p>Result verified<br />History kept</p></div>
      </div>
    </section>

    <section class="record-section content-grid section-rule" id="record">
      <div class="record-section__copy"><p class="eyebrow">04 / Your Velo</p><h2>A record<br /><em>compounds.</em></h2><p class="body-muted">Every settled Call becomes part of a public profile. Accuracy is only meaningful with the number of calls that earned it.</p><a class="text-link" href="#connect">Preview the profile shape ${icon('arrow')}</a></div>
      <div class="profile-empty">
        <div class="profile-empty__identity"><span class="profile-avatar">?</span><div><span class="mono muted">VELO PROFILE</span><strong>No profile connected</strong></div></div>
        <div class="profile-empty__stats"><div><span class="mono muted">Settled calls</span><strong>Not yet</strong></div><div><span class="mono muted">Accuracy</span><strong>Not yet</strong></div><div><span class="mono muted">On the record</span><strong>Not yet</strong></div></div>
        <div class="profile-empty__timeline"><span class="mono muted">VELO TIMELINE</span><div class="timeline-empty"><span class="timeline-empty__mark"></span><p>Your receipts will appear here after a real Call settles.</p></div></div>
      </div>
    </section>

    <section class="final-cta" id="connect">
      <div><p class="eyebrow eyebrow--accent">Start with what you actually believe</p><h2>Put your next call<br /><em>on the record.</em></h2></div>
      <button class="button button--primary connect-trigger" type="button">Connect wallet ${icon('arrow')}</button>
    </section>
  </main>

  <footer class="site-footer"><a class="wordmark" href="#top"><span class="wordmark__mark">v</span>velo</a><span class="mono">Real position. Public record.</span><span class="mono">Phase 15 / Settlement reads</span></footer>

  <div id="public-call-route" hidden></div>

  <div class="toast" role="status" aria-live="polite" aria-hidden="true">
    <div class="toast__icon">${icon('lock')}</div><div><strong class="toast__title">Wallet connection</strong><p class="toast__message">Waiting for a browser wallet.</p></div><button class="toast__close" type="button" aria-label="Close message">${icon('close')}</button>
  </div>
`

const toast = document.querySelector('.toast')
let toastTimer
const showToast = (title, message) => {
  document.querySelector('.toast__title').textContent = title
  document.querySelector('.toast__message').textContent = message
  toast.setAttribute('aria-hidden', 'false')
  toast.classList.add('toast--visible')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('toast--visible')
    toast.setAttribute('aria-hidden', 'true')
  }, 6000)
}

const shortAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`
let currentLiveMarkets = []
let selectedMarketId = null
const escapeHTML = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
const formatProbability = (value) => value === null ? 'No trade yet' : `${value.toFixed(1)}%`
const formatTimeRemaining = (expiry) => {
  const seconds = Math.max(0, Number(expiry) - Math.floor(Date.now() / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m left`
  return `${minutes}m ${String(remainder).padStart(2, '0')}s left`
}
const renderHeroMarket = ({ market, book }) => {
  const current = probabilityPercent(market.lastPrice, market.quoteDecimals)
  const bestAsk = book?.yesAsks?.[0] ? probabilityPercent(book.yesAsks[0].price, market.quoteDecimals) : null
  return `
    <article class="call-object call-object--live call-object--real" aria-label="Real live market window">
      <div class="call-object__topline"><span class="eyebrow eyebrow--accent"><span class="signal-dot"></span> Live window</span><span class="mono muted">${escapeHTML(networkLabel)}</span></div>
      <div class="call-object__subject"><span class="mono muted">${escapeHTML(market.asset)} / ${escapeHTML(market.interval || 'window')}</span><strong>${escapeHTML(market.question)}</strong></div>
      <div class="call-object__real-price">${formatProbability(current)}</div>
      <div class="call-object__metrics"><div><span class="mono muted">Current probability</span><strong>${formatProbability(current)}</strong></div><div><span class="mono muted">Best available offer</span><strong>${formatProbability(bestAsk)}</strong></div></div>
      <div class="call-object__footer"><span class="mono muted">${formatTimeRemaining(market.expiry)}</span><span class="mono muted">On-chain Trading</span></div>
    </article>
  `
}
const renderConfirmedCall = ({ market, outcomeLabel, filledQuantity, actualCost, entryProbability, transactionHash, publicCallId }) => `
  <article class="call-object call-object--live call-object--confirmed" aria-label="Confirmed Call">
    <div class="call-object__topline"><span class="eyebrow eyebrow--accent"><span class="signal-dot"></span> Call confirmed</span><span class="mono muted">${escapeHTML(networkLabel)}</span></div>
    <div class="call-object__subject"><span class="mono muted">${escapeHTML(market.asset)} / ${escapeHTML(market.interval || 'window')}</span><strong>${escapeHTML(market.question)}</strong></div>
    <div class="call-object__real-price">${escapeHTML(outcomeLabel)}</div>
    <div class="call-object__metrics"><div><span class="mono muted">Entry probability</span><strong>${formatProbability(entryProbability)}</strong></div><div><span class="mono muted">Filled amount</span><strong>${escapeHTML(filledQuantity)}</strong></div><div><span class="mono muted">Actual cost</span><strong>${escapeHTML(actualCost)}</strong></div></div>
    <div class="call-object__footer"><span class="mono muted">Confirmed fill</span><span class="call-object__footer-links">${publicCallId ? `<a class="mono call-proof-link" href="/call/${encodeURIComponent(publicCallId)}">Open public record ${icon('arrow')}</a>` : ''}<a class="mono call-proof-link" href="https://shannon-explorer.somnia.network/tx/${encodeURIComponent(transactionHash)}" target="_blank" rel="noreferrer">View proof ${icon('arrow')}</a></span></div>
  </article>
`
const renderMarketRow = ({ market, book }) => {
  const current = probabilityPercent(market.lastPrice, market.quoteDecimals)
  const bestAsk = book?.yesAsks?.[0] ? probabilityPercent(book.yesAsks[0].price, market.quoteDecimals) : null
  return `
    <article class="live-market-row">
      <div class="live-market-row__top"><span class="eyebrow eyebrow--accent"><span class="signal-dot"></span>${escapeHTML(market.asset)}</span><span class="mono muted">${escapeHTML(market.interval || 'window')}</span></div>
      <p class="live-market-row__question">${escapeHTML(market.question)}</p>
      <div class="live-market-row__data"><div><span class="mono muted">Current</span><strong>${formatProbability(current)}</strong></div><div><span class="mono muted">Best offer</span><strong>${formatProbability(bestAsk)}</strong></div><div><span class="mono muted">Window</span><strong>${formatTimeRemaining(market.expiry)}</strong></div></div>
      <button class="market-select" type="button" data-market-id="${escapeHTML(market.marketId)}">Choose window ${icon('arrow')}</button>
    </article>
  `
}
const setLivePanelMessage = ({ title, message, status }) => {
  document.querySelector('#live-panel').innerHTML = `
    <div class="empty-panel__head"><span class="mono">CURRENT WINDOWS</span><span class="mono status-copy"><span class="signal-dot"></span> ${escapeHTML(status)}</span></div>
    <div class="empty-panel__body"><div class="empty-panel__line"></div><p class="empty-panel__title">${escapeHTML(title)}</p><p class="body-muted">${escapeHTML(message)}</p></div>
    <div class="empty-panel__footer"><span class="mono">Source: DreamDEX Event Contracts</span><span class="mono">Network: ${escapeHTML(networkLabel)}</span></div>
  `
}
const loadLiveMarkets = async (event) => {
  const button = event?.currentTarget
  if (button) {
    button.disabled = true
    button.textContent = 'Reading windows'
  }
  try {
    const verified = await listVerifiedLiveMarkets()
    const withBooks = await Promise.all(verified.map(async (entry) => {
      try {
        return { ...entry, book: await getBinaryBook(entry.market) }
      } catch {
        return { ...entry, book: null }
      }
    }))
    if (withBooks.length === 0) {
      document.querySelector('#hero-call-slot').innerHTML = callObject()
      setLivePanelMessage({ title: 'No verified windows are open right now.', message: 'The source returned no markets that are still Trading on-chain. Refresh when the next windows are available.', status: 'No open windows' })
      return
    }
    const visibleMarkets = withBooks.slice(0, 12)
    currentLiveMarkets = withBooks
    document.querySelector('#hero-call-slot').innerHTML = renderHeroMarket(visibleMarkets[0])
    document.querySelector('#live-panel').innerHTML = `
      <div class="empty-panel__head"><span class="mono">CURRENT WINDOWS / ${visibleMarkets.length} OF ${withBooks.length}</span><span class="mono status-copy"><span class="signal-dot"></span> Verified live</span></div>
      <div class="live-market-list">${visibleMarkets.map(renderMarketRow).join('')}</div>
      <div class="empty-panel__footer"><span class="mono">Source: DreamDEX Event Contracts</span><span class="mono">${withBooks.length > visibleMarkets.length ? 'Showing first 12 by expiry' : 'On-chain status checked'}</span></div>
    `
  } catch (error) {
    document.querySelector('#hero-call-slot').innerHTML = callObject()
    setLivePanelMessage({ title: 'Live discovery is unavailable.', message: error instanceof Error ? error.message : 'The live market source could not be reached. Nothing is shown as current until it can be verified.', status: 'Read failed' })
  } finally {
    if (button) {
      button.disabled = false
      button.textContent = 'Refresh live windows'
    }
  }
}
const openCallLauncher = (marketId) => {
  const entry = currentLiveMarkets.find(({ market }) => market.marketId === marketId)
  if (!entry) return
  selectedMarketId = marketId
  const { market, book } = entry
  const bestAsk = book?.yesAsks?.[0] ? probabilityPercent(book.yesAsks[0].price, market.quoteDecimals) : null
  document.querySelector('#call-launcher').hidden = false
  document.querySelector('#call-launcher').innerHTML = `
    <div class="call-launcher__head"><div><span class="eyebrow eyebrow--accent">New Call</span><h3>${escapeHTML(market.asset)} / ${escapeHTML(market.interval || 'window')}</h3><p>${escapeHTML(market.question)}</p></div><button class="launcher-close" type="button" aria-label="Close Call form">${icon('close')}</button></div>
    <form class="call-form" id="call-form">
      <fieldset><legend>Choose your side</legend><div class="side-options"><label class="side-option"><input type="radio" name="outcome" value="0" checked /><span>Yes</span><small>The event happens</small></label><label class="side-option"><input type="radio" name="outcome" value="1" /><span>No</span><small>The event does not happen</small></label></div></fieldset>
      <label class="amount-field"><span>Amount in contracts</span><input type="number" name="amount" min="0" step="any" inputmode="decimal" placeholder="Enter an amount" required /><small>Only the amount that fills becomes a Call.</small></label>
      <div class="call-form__summary"><span class="mono">Best available offer</span><strong>${formatProbability(bestAsk)}</strong><span class="mono">Immediate execution</span></div>
      <button class="button button--primary" type="submit">Publish Call ${icon('arrow')}</button>
      <p class="call-form__note">Your wallet will confirm the transaction. A Call is created only after the transaction confirms with a nonzero fill.</p>
    </form>
  `
  document.querySelector('#call-launcher').scrollIntoView({ behavior: 'smooth', block: 'center' })
  document.querySelector('.launcher-close').addEventListener('click', closeCallLauncher)
  document.querySelector('#call-form').addEventListener('submit', handleCallSubmit)
}
const closeCallLauncher = () => {
  selectedMarketId = null
  const launcher = document.querySelector('#call-launcher')
  launcher.hidden = true
  launcher.innerHTML = ''
}
const handleCallSubmit = async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  const submitButton = form.querySelector('button[type="submit"]')
  if (!getConnectedWallet()) {
    showToast('Connect wallet first', `Connect a wallet on ${networkLabel} before publishing a Call.`)
    return
  }
  submitButton.disabled = true
  submitButton.textContent = 'Confirming transaction'
  const formData = new FormData(form)
  try {
    const result = await publishCall({ marketId: selectedMarketId, outcome: Number(formData.get('outcome')), amount: formData.get('amount') })
    submitButton.textContent = 'Saving public record'
    document.querySelector('#hero-call-slot').innerHTML = renderConfirmedCall(result)
    try {
      const record = await persistCall(result)
      document.querySelector('#hero-call-slot').innerHTML = renderConfirmedCall({ ...result, publicCallId: record.id })
      document.querySelector('#call-launcher').innerHTML = `<div class="call-confirmation"><span class="eyebrow eyebrow--accent"><span class="signal-dot"></span> Public record ready</span><h3>Your Call is ready to share.</h3><p>${escapeHTML(result.filledQuantity)} contracts of ${escapeHTML(result.outcomeLabel)} filled at an entry probability of ${formatProbability(result.entryProbability)}. Actual cost: ${escapeHTML(result.actualCost)}.</p><div class="call-confirmation__actions"><a class="button button--primary" href="/call/${encodeURIComponent(record.id)}">Open public record ${icon('arrow')}</a><a class="text-link" href="https://shannon-explorer.somnia.network/tx/${encodeURIComponent(result.transactionHash)}" target="_blank" rel="noreferrer">Inspect transaction proof ${icon('arrow')}</a></div><p class="call-confirmation__note">The public view shows verified Call facts. Proof details stay behind its Proof view.</p></div>`
      showToast('Call published', `${result.outcomeLabel} filled. Your public record is ready to share.`)
    } catch (error) {
      document.querySelector('#call-launcher').innerHTML = `<div class="call-confirmation"><span class="eyebrow eyebrow--accent"><span class="signal-dot"></span> Confirmed fill</span><h3>Your Call is confirmed.</h3><p>${escapeHTML(result.filledQuantity)} contracts of ${escapeHTML(result.outcomeLabel)} filled at an entry probability of ${formatProbability(result.entryProbability)}. Actual cost: ${escapeHTML(result.actualCost)}.</p><a class="text-link" href="https://shannon-explorer.somnia.network/tx/${encodeURIComponent(result.transactionHash)}" target="_blank" rel="noreferrer">Inspect transaction proof ${icon('arrow')}</a><p class="call-confirmation__note">The public record could not be saved yet. Keep the transaction proof and try again from the same wallet.</p></div>`
      showToast('Call confirmed, record pending', error instanceof Error ? error.message : 'The fill is confirmed, but the public record is not available yet.')
    }
  } catch (error) {
    showToast('Call not created', error instanceof Error ? error.message : 'The transaction could not be confirmed. No Call was created.')
    submitButton.disabled = false
    submitButton.textContent = 'Publish Call'
  }
}

const publicCallId = location.pathname.match(/^\/call\/([a-f0-9]{24})$/i)?.[1]
const publicProfileAddress = location.pathname.match(/^\/profile\/(0x[a-f0-9]{40})$/i)?.[1]
const renderPublicCall = (call, proof = null) => `
  <main class="public-call-page">
    <div class="public-call-page__top"><a class="wordmark" href="/"><span class="wordmark__mark" aria-hidden="true">v</span>velo</a><span class="mono">Public Call / ${escapeHTML(call.id)}</span></div>
    <section class="public-call-page__intro"><p class="eyebrow eyebrow--accent"><span class="signal-dot"></span> ${escapeHTML(call.result || call.state)} record</p><h1>${escapeHTML(call.result || call.outcome)}<br /><em>on the record.</em></h1><p class="public-call-page__lede">A verified Call from a real DreamDEX fill on ${escapeHTML(networkLabel)}.</p></section>
    <article class="public-record-card"><div class="public-record-card__head"><span class="mono">${escapeHTML(call.asset)} / ${escapeHTML(call.interval || 'window')}</span><span class="mono">${escapeHTML(call.state)}</span></div><div class="public-record-card__question"><span class="mono muted">Question</span><h2>${escapeHTML(call.question)}</h2></div><div class="public-record-card__metrics"><div><span class="mono muted">Backed side</span><strong>${escapeHTML(call.outcome)}</strong></div><div><span class="mono muted">Entry probability</span><strong>${formatProbability(call.entryProbability)}</strong></div><div><span class="mono muted">Current probability</span><strong>${formatProbability(call.currentProbability)}</strong></div><div><span class="mono muted">Filled contracts</span><strong>${escapeHTML(call.filledQuantity)}</strong></div><div><span class="mono muted">Actual cost</span><strong>${escapeHTML(call.actualCost)}</strong></div><div><span class="mono muted">Window</span><strong>${formatTimeRemaining(call.expiry)}</strong></div></div><div class="public-record-card__foot"><span class="mono">Confirmed fill required</span><span class="mono">Public facts only</span></div></article>
    ${call.successor || call.result ? `<div class="public-successor">${call.successor ? `<span class="mono muted">NEXT IN THIS SERIES</span><a class="text-link" href="/call/${encodeURIComponent(call.successor.id)}">Open the next ${escapeHTML(call.successor.asset)} Call ${icon('arrow')}</a>` : `<span class="mono muted">SERIES CONTINUES</span><a class="text-link" href="/#live">Find the next live window ${icon('arrow')}</a>`}</div>` : ''}
    <div class="public-call-page__actions">${call.backing?.available ? `<button class="button button--primary public-back-trigger" type="button">Back this live Call ${icon('arrow')}</button>` : ''}<button class="button button--outline public-copy-trigger" type="button">Copy link ${icon('link')}</button><button class="button button--outline public-share-trigger" type="button">Share ${icon('arrow')}</button><button class="button button--outline public-proof-trigger" type="button">View proof ${icon('arrow')}</button><a class="text-link" href="/">Make your own Call ${icon('arrow')}</a></div>
    <div class="public-proof" id="public-proof" ${proof ? '' : 'hidden'}>${proof ? renderPublicProof(proof) : ''}</div>
  </main>
`
const renderPublicProof = (proof) => `<div class="public-proof__inner"><span class="eyebrow eyebrow--accent"><span class="signal-dot"></span> Verified proof</span><h2>Check the receipt.</h2><dl><div><dt class="mono muted">Transaction</dt><dd><a class="text-link" href="${escapeHTML(proof.proof.url)}" target="_blank" rel="noreferrer">${escapeHTML(proof.proof.transactionHash.slice(0, 10))}...${escapeHTML(proof.proof.transactionHash.slice(-8))} ${icon('arrow')}</a></dd></div><div><dt class="mono muted">Market id</dt><dd class="mono">${escapeHTML(proof.proof.marketId)}</dd></div><div><dt class="mono muted">Fill block</dt><dd class="mono">${escapeHTML(proof.proof.fillBlockNumber)}</dd></div><div><dt class="mono muted">Verified</dt><dd class="mono">${escapeHTML(proof.proof.verifiedAt)}</dd></div></dl>${proof.proof.resolutionTransactionHash ? `<p class="public-proof__resolution"><span class="mono muted">Resolution receipt</span> ${escapeHTML(proof.proof.resolutionTransactionHash.slice(0, 10))}...${escapeHTML(proof.proof.resolutionTransactionHash.slice(-8))}</p>` : ''}<a class="text-link" href="/profile/${encodeURIComponent(proof.proof.walletAddress)}">View public Velo ${icon('arrow')}</a></div>`
const renderPublicError = (message) => `<main class="public-call-page public-call-page--error"><div class="public-call-page__top"><a class="wordmark" href="/"><span class="wordmark__mark" aria-hidden="true">v</span>velo</a><span class="mono">Public Call</span></div><section class="public-call-page__intro"><p class="eyebrow eyebrow--accent">Record unavailable</p><h1>This Call<br /><em>is not here.</em></h1><p class="public-call-page__lede">${escapeHTML(message)}</p><a class="button button--primary" href="/">Return to Velo ${icon('arrow')}</a></section></main>`
const renderPublicProfile = (profile) => {
  const accuracy = profile.accuracy === null ? 'Not yet' : `${profile.accuracy.toFixed(1)}%`
  const calls = profile.calls.length ? profile.calls.map((call) => `<a class="profile-call-row" href="/call/${encodeURIComponent(call.id)}"><span class="profile-call-row__status">${escapeHTML(call.result || call.state)}</span><span class="profile-call-row__main"><strong>${escapeHTML(call.outcome)} / ${escapeHTML(call.asset)}</strong><span>${escapeHTML(call.question)}</span></span><span class="mono">${formatProbability(call.entryProbability)}</span>${icon('arrow')}</a>`).join('') : '<div class="profile-timeline-empty"><span class="empty-mark" aria-hidden="true">+</span><p>No verified Calls yet. A profile starts when a real fill becomes a public record.</p></div>'
  return `<main class="public-call-page public-profile-page"><div class="public-call-page__top"><a class="wordmark" href="/"><span class="wordmark__mark" aria-hidden="true">v</span>velo</a><span class="mono">Public Velo</span></div><section class="public-call-page__intro"><p class="eyebrow eyebrow--accent"><span class="signal-dot"></span> Earned record</p><h1>Velo<br /><em>takes time.</em></h1><p class="public-call-page__lede">A public history of confirmed Calls from ${escapeHTML(networkLabel)}.</p></section><section class="profile-public-card"><div class="profile-public-card__identity"><span class="profile-avatar">v</span><div><span class="mono muted">PUBLIC VELO</span><strong>Verified Call history</strong></div></div><div class="profile-empty__stats"><div><span class="mono muted">Settled Calls</span><strong>${profile.settledCalls}</strong></div><div><span class="mono muted">Accuracy</span><strong>${accuracy}</strong></div><div><span class="mono muted">Public Calls</span><strong>${profile.calls.length}</strong></div></div></section><section class="profile-public-timeline"><div class="public-profile-section-head"><p class="eyebrow">Velo timeline</p><span class="mono">${profile.calls.length} recorded</span></div><div class="profile-call-list">${calls}</div></section></main>`
}
const loadPublicCallRoute = async () => {
  if (!publicCallId) return false
  document.querySelector('main#top').hidden = true
  document.querySelector('.site-footer').hidden = true
  const route = document.querySelector('#public-call-route')
  route.hidden = false
  route.innerHTML = '<main class="public-call-page"><p class="mono public-call-loading">Reading public record</p></main>'
  try {
    const call = await getPublicCall(publicCallId)
    document.title = `${call.result || call.outcome} Call | Velo`
    document.querySelector('meta[property="og:title"]').setAttribute('content', `${call.result || call.outcome} Call | Velo`)
    document.querySelector('meta[property="og:description"]').setAttribute('content', `${call.asset} / ${call.interval || 'window'} on ${networkLabel}. A confirmed Call with a real position behind it.`)
    route.innerHTML = renderPublicCall(call)
    route.querySelector('.public-back-trigger')?.addEventListener('click', () => openPublicBackingForm(route, call))
    const publicUrl = window.location.href
    route.querySelector('.public-copy-trigger')?.addEventListener('click', async (event) => {
      try {
        await navigator.clipboard.writeText(publicUrl)
        event.currentTarget.textContent = 'Link copied'
        showToast('Link copied', 'Your public Call link is ready to share.')
      } catch {
        showToast('Copy unavailable', 'Select the URL in your browser to share this Call.')
      }
    })
    route.querySelector('.public-share-trigger')?.addEventListener('click', async () => {
      if (navigator.share) {
        await navigator.share({ title: document.title, text: `${call.outcome} on the record`, url: publicUrl }).catch(() => {})
      } else {
        try {
          await navigator.clipboard.writeText(publicUrl)
          showToast('Link copied', 'Native sharing is unavailable here, so the link was copied instead.')
        } catch {
          showToast('Share unavailable', 'Select the URL in your browser to share this Call.')
        }
      }
    })
    route.querySelector('.public-proof-trigger').addEventListener('click', async (event) => {
      const button = event.currentTarget
      button.disabled = true
      button.textContent = 'Reading proof'
      try {
        const proof = await getPublicCall(publicCallId, true)
        route.querySelector('#public-proof').hidden = false
        route.querySelector('#public-proof').innerHTML = renderPublicProof(proof)
        button.remove()
      } catch (error) {
        showToast('Proof unavailable', error instanceof Error ? error.message : 'The proof could not be loaded.')
        button.disabled = false
        button.textContent = 'View proof'
      }
    })
  } catch (error) {
    route.innerHTML = renderPublicError(error instanceof Error ? error.message : 'The public Call could not be found.')
  }
  return true
}
let publicBackingMarketId = null
const handlePublicBackingSubmit = async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  const submitButton = form.querySelector('button[type="submit"]')
  if (!getConnectedWallet()) {
    showToast('Connect wallet first', `Connect a wallet on ${networkLabel} before backing a Call.`)
    return
  }
  submitButton.disabled = true
  submitButton.textContent = 'Confirming transaction'
  try {
    const formData = new FormData(form)
    const result = await publishCall({ marketId: publicBackingMarketId, outcome: Number(formData.get('outcome')), amount: formData.get('amount') })
    submitButton.textContent = 'Saving public record'
    const record = await persistCall(result)
    window.location.href = `/call/${encodeURIComponent(record.id)}`
  } catch (error) {
    showToast('Call not created', error instanceof Error ? error.message : 'The backing transaction could not be confirmed.')
    submitButton.disabled = false
    submitButton.textContent = 'Back this Call'
  }
}
const openPublicBackingForm = async (route, call) => {
  const button = route.querySelector('.public-back-trigger')
  if (!button) return
  button.disabled = true
  button.textContent = 'Reading current offer'
  try {
    const entries = await listVerifiedLiveMarkets()
    const entry = entries.find(({ market }) => market.marketId.toLowerCase() === call.backing.key.toLowerCase())
    if (!entry) throw new Error('This Call is no longer live. Refresh the record to see its current state.')
    const book = await getBinaryBook(entry.market)
    const yesAsk = book?.yesAsks?.[0] ? probabilityPercent(book.yesAsks[0].price, entry.market.quoteDecimals) : null
    const noAsk = book?.noAsks?.[0] ? probabilityPercent(book.noAsks[0].price, entry.market.quoteDecimals) : null
    publicBackingMarketId = entry.market.marketId
    button.outerHTML = `<section class="public-back-panel"><div class="call-launcher__head"><div><span class="eyebrow eyebrow--accent">Back this Call</span><h2>Take your own side.</h2><p>The new Call will be an independent confirmed position from your wallet.</p></div></div><form class="call-form" id="public-call-form"><fieldset><legend>Choose your side</legend><div class="side-options"><label class="side-option"><input type="radio" name="outcome" value="0" checked /><span>Yes</span><small>The event happens</small></label><label class="side-option"><input type="radio" name="outcome" value="1" /><span>No</span><small>The event does not happen</small></label></div></fieldset><label class="amount-field"><span>Amount in contracts</span><input type="number" name="amount" min="0" step="any" inputmode="decimal" placeholder="Enter an amount" required /><small>Only the amount that fills becomes a Call.</small></label><div class="call-form__summary"><span class="mono">Yes offer</span><strong>${formatProbability(yesAsk)}</strong><span class="mono">No offer</span><strong>${formatProbability(noAsk)}</strong><span class="mono">Immediate execution</span></div><button class="button button--primary" type="submit">Back this Call ${icon('arrow')}</button><p class="call-form__note">Your wallet confirms a new transaction. A separate public record is created only after a nonzero fill.</p></form></section>`
    route.querySelector('#public-call-form').addEventListener('submit', handlePublicBackingSubmit)
  } catch (error) {
    showToast('Backing unavailable', error instanceof Error ? error.message : 'The current offer could not be loaded.')
    button.disabled = false
    button.textContent = 'Back this live Call'
  }
}
const loadPublicProfileRoute = async () => {
  if (!publicProfileAddress) return false
  document.querySelector('main#top').hidden = true
  document.querySelector('.site-footer').hidden = true
  const route = document.querySelector('#public-call-route')
  route.hidden = false
  route.innerHTML = '<main class="public-call-page"><p class="mono public-call-loading">Reading Velo</p></main>'
  try {
    route.innerHTML = renderPublicProfile(await getPublicProfile(publicProfileAddress))
  } catch (error) {
    route.innerHTML = renderPublicError(error instanceof Error ? error.message : 'The public Velo record could not be found.')
  }
  return true
}
const handleWalletConnect = async (event) => {
  const button = event.currentTarget
  const originalLabel = button.textContent.trim()
  button.disabled = true
  button.textContent = 'Connecting'
  try {
    const address = await connectWallet()
    document.querySelectorAll('.connect-trigger').forEach((trigger) => {
      trigger.textContent = shortAddress(address)
      trigger.classList.add('button--connected')
    })
    document.querySelectorAll('a[href="#record"]').forEach((link) => { link.href = `/profile/${encodeURIComponent(address)}` })
    showToast('Wallet connected', `${shortAddress(address)} is connected on ${networkLabel}.`)
  } catch (error) {
    showToast('Wallet not connected', error instanceof Error ? error.message : 'The wallet request could not be completed.')
  } finally {
    button.disabled = false
    if (!document.querySelector('.button--connected')) button.textContent = originalLabel
  }
}

document.querySelectorAll('.connect-trigger').forEach((button) => button.addEventListener('click', handleWalletConnect))
document.querySelectorAll('.refresh-trigger').forEach((button) => button.addEventListener('click', loadLiveMarkets))
document.querySelector('#live-panel').addEventListener('click', (event) => {
  const selectButton = event.target.closest('[data-market-id]')
  if (selectButton) openCallLauncher(selectButton.dataset.marketId)
})
const scheduleLiveMarkets = () => {
  const run = () => loadLiveMarkets()
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1200 })
  else window.setTimeout(run, 250)
}
if (!publicCallId && !publicProfileAddress) scheduleLiveMarkets()
document.querySelector('.toast__close').addEventListener('click', () => {
  toast.classList.remove('toast--visible')
  toast.setAttribute('aria-hidden', 'true')
})

const menuTrigger = document.querySelector('.menu-trigger')
const mobileNav = document.querySelector('.mobile-nav')
menuTrigger.addEventListener('click', () => {
  const isOpen = menuTrigger.getAttribute('aria-expanded') === 'true'
  menuTrigger.setAttribute('aria-expanded', String(!isOpen))
  menuTrigger.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation')
  menuTrigger.innerHTML = icon(isOpen ? 'menu' : 'close')
  mobileNav.classList.toggle('mobile-nav--open', !isOpen)
})

mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menuTrigger.setAttribute('aria-expanded', 'false')
  menuTrigger.setAttribute('aria-label', 'Open navigation')
  menuTrigger.innerHTML = icon('menu')
  mobileNav.classList.remove('mobile-nav--open')
}))

loadPublicCallRoute()
loadPublicProfileRoute()
