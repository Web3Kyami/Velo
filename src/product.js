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

const escapeHTML = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
})[character])

const shortAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`
const formatProbability = (value) => value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`
const displaySide = (value) => Number(value) === 0 || value === 'Yes' ? 'Higher' : 'Lower'
const secondsLeft = (expiry) => Math.max(0, Number(expiry) - Math.floor(Date.now() / 1000))
const formatTimeRemaining = (expiry) => {
  const seconds = secondsLeft(expiry)
  if (seconds <= 0) return 'Closed'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}:${String(remainder).padStart(2, '0')}`
}

document.body.className = 'product-body'
document.title = 'Live markets | Velo'
document.querySelector('#app').innerHTML = `
  <header class="app-header">
    <a class="brand" href="/"><span class="brand-mark">v</span><span>velo</span></a>
    <div class="app-header__actions">
      <button class="nav-action my-velo-trigger" type="button">My Velo</button>
      <button class="wallet-button connect-trigger" type="button">Connect wallet</button>
    </div>
  </header>

  <main class="product-shell">
    <section class="app-heading">
      <div>
        <p class="eyebrow"><span class="live-dot"></span>${escapeHTML(networkLabel)}</p>
        <h1>Live markets</h1>
        <p>Choose a window, take a side and put the call on your record.</p>
      </div>
      <button class="refresh-trigger icon-button" type="button" aria-label="Refresh live markets">Refresh</button>
    </section>

    <section class="market-board" aria-live="polite">
      <div class="market-board__head">
        <span>Market</span>
        <span>Higher</span>
        <span>Lower</span>
        <span>Closes in</span>
        <span></span>
      </div>
      <div id="live-panel" class="market-board__body">
        <div class="loading-row"><span class="loading-pulse"></span><span>Loading live markets</span></div>
      </div>
    </section>
  </main>

  <div class="trade-modal" id="trade-modal" hidden>
    <button class="trade-modal__backdrop modal-close" type="button" aria-label="Close trade"></button>
    <section class="trade-sheet" role="dialog" aria-modal="true" aria-labelledby="trade-title">
      <button class="trade-sheet__close modal-close" type="button" aria-label="Close trade">×</button>
      <div id="trade-content"></div>
    </section>
  </div>

  <div class="toast" role="status" aria-live="polite" aria-hidden="true">
    <strong class="toast__title">Velo</strong>
    <span class="toast__message"></span>
    <button class="toast__close" type="button" aria-label="Close message">×</button>
  </div>
`

const toast = document.querySelector('.toast')
const modal = document.querySelector('#trade-modal')
const tradeContent = document.querySelector('#trade-content')
let toastTimer
let timerHandle
let currentLiveMarkets = []
let selectedMarketId = null

const showToast = (title, message) => {
  document.querySelector('.toast__title').textContent = title
  document.querySelector('.toast__message').textContent = message
  toast.classList.add('toast--visible')
  toast.setAttribute('aria-hidden', 'false')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('toast--visible')
    toast.setAttribute('aria-hidden', 'true')
  }, 5500)
}

const updateWalletUI = (address) => {
  document.querySelectorAll('.connect-trigger').forEach((button) => {
    button.textContent = shortAddress(address)
    button.classList.add('is-connected')
  })
}

const ensureWallet = async () => {
  if (getConnectedWallet()) return getConnectedWallet()
  const address = await connectWallet()
  updateWalletUI(address)
  showToast('Wallet connected', `${shortAddress(address)} is ready on ${networkLabel}.`)
  return address
}

const renderMarketRow = ({ market, book }) => {
  const yes = book?.yesAsks?.[0] ? probabilityPercent(book.yesAsks[0].price, market.quoteDecimals) : null
  const no = book?.noAsks?.[0] ? probabilityPercent(book.noAsks[0].price, market.quoteDecimals) : null
  return `
    <article class="market-row" data-market-card="${escapeHTML(market.marketId)}">
      <button class="market-row__click" type="button" data-market-id="${escapeHTML(market.marketId)}" aria-label="Open ${escapeHTML(market.asset)} ${escapeHTML(market.interval || '')} trade"></button>
      <div class="market-main">
        <div class="market-identity">
          <span class="asset-badge">${escapeHTML(market.asset)}</span>
          <span class="window-label">${escapeHTML(market.interval || 'Live')}</span>
        </div>
        <p>${escapeHTML(market.question)}</p>
      </div>
      <div class="quote quote--higher"><span>Higher</span><strong>${formatProbability(yes)}</strong></div>
      <div class="quote quote--lower"><span>Lower</span><strong>${formatProbability(no)}</strong></div>
      <div class="countdown" data-expiry="${escapeHTML(market.expiry)}">${formatTimeRemaining(market.expiry)}</div>
      <div class="row-action">Open</div>
    </article>
  `
}

const renderPanelMessage = (title, message) => {
  document.querySelector('#live-panel').innerHTML = `
    <div class="empty-board">
      <strong>${escapeHTML(title)}</strong>
      <span>${escapeHTML(message)}</span>
      <button class="button-secondary retry-trigger" type="button">Try again</button>
    </div>
  `
  document.querySelector('.retry-trigger')?.addEventListener('click', loadLiveMarkets)
}

const tickCountdowns = () => {
  let expired = false
  document.querySelectorAll('[data-expiry]').forEach((element) => {
    const expiry = Number(element.dataset.expiry)
    element.textContent = formatTimeRemaining(expiry)
    if (secondsLeft(expiry) <= 0) {
      element.classList.add('is-closed')
      const card = element.closest('[data-market-card]')
      const opener = card?.querySelector('[data-market-id]')
      if (opener && !opener.disabled) {
        opener.disabled = true
        card.classList.add('market-row--closed')
        expired = true
      }
    }
  })
  if (expired) window.setTimeout(() => loadLiveMarkets(), 1500)
}

const startCountdowns = () => {
  window.clearInterval(timerHandle)
  tickCountdowns()
  timerHandle = window.setInterval(tickCountdowns, 1000)
}

async function loadLiveMarkets(event) {
  const button = event?.currentTarget
  if (button) {
    button.disabled = true
    button.textContent = 'Refreshing'
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

    currentLiveMarkets = withBooks
      .filter(({ market }) => secondsLeft(market.expiry) > 0)
      .sort((a, b) => Number(a.market.expiry) - Number(b.market.expiry))

    if (!currentLiveMarkets.length) {
      renderPanelMessage('No live markets right now', 'The next rolling window will appear here as soon as it opens.')
      return
    }

    document.querySelector('#live-panel').innerHTML = currentLiveMarkets.slice(0, 12).map(renderMarketRow).join('')
    startCountdowns()
  } catch (error) {
    renderPanelMessage('Live markets are unavailable', error instanceof Error ? error.message : 'Velo could not read current markets.')
  } finally {
    if (button) {
      button.disabled = false
      button.textContent = 'Refresh'
    }
  }
}

const selectedEntry = () => currentLiveMarkets.find(({ market }) => market.marketId === selectedMarketId)

const priceForOutcome = (entry, outcome) => {
  const level = outcome === 0 ? entry?.book?.yesAsks?.[0] : entry?.book?.noAsks?.[0]
  return level ? probabilityPercent(level.price, entry.market.quoteDecimals) : null
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
  const stake = form.querySelector('[name="stake"]').value
  const price = priceForOutcome(entry, outcome)
  const contracts = estimatedContracts(stake, price)
  const estimate = form.querySelector('.trade-estimate strong')
  const priceLabel = form.querySelector('.trade-estimate__price')
  estimate.textContent = contracts ? `≈ ${contracts.toFixed(2)} contracts` : 'Enter a stake'
  priceLabel.textContent = price === null ? 'No offer available' : `Current entry ${formatProbability(price)}`
}

const renderTradeForm = (entry) => {
  const { market } = entry
  const yes = priceForOutcome(entry, 0)
  const no = priceForOutcome(entry, 1)
  const higherChecked = yes !== null || no === null
  const lowerChecked = !higherChecked

  return `
    <div class="trade-sheet__meta">
      <div><span class="asset-badge">${escapeHTML(market.asset)}</span><span class="window-label">${escapeHTML(market.interval || 'Live')}</span></div>
      <span class="modal-countdown" data-expiry="${escapeHTML(market.expiry)}">${formatTimeRemaining(market.expiry)}</span>
    </div>
    <div class="trade-sheet__title">
      <p class="eyebrow"><span class="live-dot"></span>Make a Call</p>
      <h2 id="trade-title">${escapeHTML(market.question)}</h2>
    </div>
    <form id="trade-form" class="trade-form">
      <fieldset>
        <legend>Choose your side</legend>
        <div class="side-grid">
          <label class="side-card side-card--higher">
            <input type="radio" name="outcome" value="0" ${higherChecked ? 'checked' : ''} ${yes === null ? 'disabled' : ''}>
            <span>Higher</span>
            <strong>${formatProbability(yes)}</strong>
          </label>
          <label class="side-card side-card--lower">
            <input type="radio" name="outcome" value="1" ${lowerChecked ? 'checked' : ''} ${no === null ? 'disabled' : ''}>
            <span>Lower</span>
            <strong>${formatProbability(no)}</strong>
          </label>
        </div>
      </fieldset>

      <div class="stake-block">
        <div class="stake-label"><span>Stake</span><span>Testnet collateral</span></div>
        <div class="stake-input"><span>$</span><input name="stake" type="number" min="0" step="any" inputmode="decimal" placeholder="0.00" required></div>
        <div class="stake-presets">
          <button type="button" data-stake="5">$5</button>
          <button type="button" data-stake="10">$10</button>
          <button type="button" data-stake="25">$25</button>
          <button type="button" data-stake="50">$50</button>
        </div>
      </div>

      <div class="trade-estimate">
        <div><span>Estimated position</span><strong>Enter a stake</strong></div>
        <span class="trade-estimate__price">${(higherChecked ? yes : no) === null ? 'No offer available' : `Current entry ${formatProbability(higherChecked ? yes : no)}`}</span>
      </div>

      <button class="publish-button" type="submit">Publish Call</button>
      <p class="trade-footnote">Your final entry is the price that actually fills.</p>
    </form>
  `
}

const closeTrade = () => {
  modal.hidden = true
  document.body.classList.remove('modal-open')
  selectedMarketId = null
  tradeContent.innerHTML = ''
}

const openTrade = (marketId) => {
  const entry = currentLiveMarkets.find(({ market }) => market.marketId === marketId)
  if (!entry || secondsLeft(entry.market.expiry) <= 0) {
    showToast('Window closed', 'Choose another live market.')
    return
  }

  selectedMarketId = marketId
  tradeContent.innerHTML = renderTradeForm(entry)
  modal.hidden = false
  document.body.classList.add('modal-open')
  updateTradeEstimate()
  tickCountdowns()

  const form = document.querySelector('#trade-form')
  form.addEventListener('change', updateTradeEstimate)
  form.querySelector('[name="stake"]').addEventListener('input', updateTradeEstimate)
  form.querySelectorAll('[data-stake]').forEach((button) => {
    button.addEventListener('click', () => {
      form.querySelector('[name="stake"]').value = button.dataset.stake
      updateTradeEstimate()
    })
  })
  form.addEventListener('submit', handleCallSubmit)
}

const renderSuccess = ({ result, record }) => {
  const side = displaySide(result.outcome)
  const url = `${window.location.origin}/call/${record.id}`
  tradeContent.innerHTML = `
    <div class="trade-success">
      <span class="success-check">✓</span>
      <p class="eyebrow">Call published</p>
      <h2>${escapeHTML(result.market.asset)} ${side}</h2>
      <p>Your position filled at ${formatProbability(result.entryProbability)} and is now on your public record.</p>
      <div class="success-stats">
        <div><span>Side</span><strong>${side}</strong></div>
        <div><span>Filled</span><strong>${escapeHTML(result.filledQuantity)}</strong></div>
        <div><span>Cost</span><strong>${escapeHTML(result.actualCost)}</strong></div>
      </div>
      <a class="publish-button" href="/call/${encodeURIComponent(record.id)}">View Call</a>
      <button class="button-secondary share-call-trigger" type="button">Share Call</button>
    </div>
  `
  document.querySelector('.share-call-trigger').addEventListener('click', async () => {
    if (navigator.share) {
      await navigator.share({ title: `${result.market.asset} ${side} | Velo`, text: 'My call is on the record.', url }).catch(() => {})
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copied', 'Your public Call is ready to share.')
    } catch {
      showToast('Share unavailable', 'Copy the Call URL from your browser.')
    }
  })
}

async function handleCallSubmit(event) {
  event.preventDefault()
  const form = event.currentTarget
  const submit = form.querySelector('button[type="submit"]')
  const entry = selectedEntry()
  if (!entry) return

  const data = new FormData(form)
  const outcome = Number(data.get('outcome'))
  const stake = Number(data.get('stake'))
  const probability = priceForOutcome(entry, outcome)
  const amount = estimatedContracts(stake, probability)

  if (!Number.isFinite(stake) || stake <= 0) {
    showToast('Enter a stake', 'Choose how much you want to put behind this Call.')
    return
  }
  if (!amount) {
    showToast('No offer available', 'Choose a side with a live offer and try again.')
    return
  }

  submit.disabled = true
  submit.textContent = 'Preparing wallet'

  try {
    await ensureWallet()
    submit.textContent = 'Confirm in wallet'
    const result = await publishCall({
      marketId: selectedMarketId,
      outcome,
      amount: Number(amount.toFixed(8)),
    })
    submit.textContent = 'Saving Call'
    const record = await persistCall(result)
    renderSuccess({ result, record })
  } catch (error) {
    submit.disabled = false
    submit.textContent = 'Publish Call'
    showToast('Call not created', error instanceof Error ? error.message : 'The transaction could not be completed.')
  }
}

const handleWalletConnect = async (event) => {
  const button = event.currentTarget
  const original = button.textContent
  button.disabled = true
  button.textContent = 'Connecting'
  try {
    await ensureWallet()
  } catch (error) {
    showToast('Wallet not connected', error instanceof Error ? error.message : 'The wallet request could not be completed.')
  } finally {
    button.disabled = false
    if (!getConnectedWallet()) button.textContent = original
  }
}

const handleMyVelo = async () => {
  try {
    const address = await ensureWallet()
    window.location.href = `/profile/${encodeURIComponent(address)}`
  } catch (error) {
    showToast('Wallet not connected', error instanceof Error ? error.message : 'Connect your wallet to open My Velo.')
  }
}

document.querySelector('.connect-trigger').addEventListener('click', handleWalletConnect)
document.querySelector('.my-velo-trigger').addEventListener('click', handleMyVelo)
document.querySelector('.refresh-trigger').addEventListener('click', loadLiveMarkets)
document.querySelector('#live-panel').addEventListener('click', (event) => {
  const button = event.target.closest('[data-market-id]')
  if (button) openTrade(button.dataset.marketId)
})
document.querySelectorAll('.modal-close').forEach((button) => button.addEventListener('click', closeTrade))
document.querySelector('.toast__close').addEventListener('click', () => {
  toast.classList.remove('toast--visible')
  toast.setAttribute('aria-hidden', 'true')
})
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) closeTrade()
})

loadLiveMarkets()
