import './styles.css'
import './public-v2.css'
import {
  connectWallet,
  getBinaryBook,
  getClaimablePositions,
  getConnectedWallet,
  getPublicCall,
  getPublicProfile,
  listVerifiedLiveMarkets,
  networkLabel,
  persistCall,
  probabilityPercent,
  publishCall,
  redeemClaimablePosition,
} from './dreamdex.js'

document.body.className = 'public-body'

const escapeHTML = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
})[character])
const shortAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`
const formatProbability = (value) => value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`
const sideLabel = (side) => String(side).toLowerCase() === 'yes' ? 'Higher' : 'Lower'
const secondsLeft = (expiry) => Math.max(0, Number(expiry) - Math.floor(Date.now() / 1000))
const formatTimeRemaining = (expiry) => {
  const seconds = secondsLeft(expiry)
  if (seconds <= 0) return 'Closed'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}:${String(remainder).padStart(2, '0')}`
}
const callId = window.location.pathname.match(/^\/call\/([a-f0-9]{24})$/i)?.[1]
const profileAddress = window.location.pathname.match(/^\/profile\/(0x[a-f0-9]{40})$/i)?.[1]

const topBar = (label) => `
  <header class="public-header">
    <a class="public-brand" href="/"><span>v</span>velo</a>
    <span class="public-header__label">${escapeHTML(label)}</span>
    <a class="public-open-app" href="/app">Open Velo</a>
  </header>
`

const renderError = (message) => `
  <main class="public-shell">
    ${topBar('Velo')}
    <section class="public-error">
      <span>Record unavailable</span>
      <h1>This page is not available.</h1>
      <p>${escapeHTML(message)}</p>
      <a href="/app">Open Velo</a>
    </section>
  </main>
`

let toast
let toastTimer
const showToast = (title, message) => {
  if (!toast) {
    toast = document.createElement('div')
    toast.className = 'public-toast-v2'
    document.body.append(toast)
  }
  toast.innerHTML = `<strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span>`
  toast.classList.add('is-visible')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 5500)
}

const renderProof = (payload) => `
  <section class="proof-drawer">
    <div class="section-heading">
      <span>Verification</span>
      <h2>Proof</h2>
    </div>
    <dl>
      <div><dt>Transaction</dt><dd><a href="${escapeHTML(payload.proof.url)}" target="_blank" rel="noreferrer">${escapeHTML(payload.proof.transactionHash.slice(0, 12))}...${escapeHTML(payload.proof.transactionHash.slice(-8))}</a></dd></div>
      <div><dt>Market ID</dt><dd>${escapeHTML(payload.proof.marketId)}</dd></div>
      <div><dt>Fill block</dt><dd>${escapeHTML(payload.proof.fillBlockNumber)}</dd></div>
      <div><dt>Verified</dt><dd>${escapeHTML(new Date(payload.proof.verifiedAt).toLocaleString())}</dd></div>
    </dl>
    <a class="subtle-link" href="/profile/${encodeURIComponent(payload.proof.walletAddress)}">View trader profile</a>
  </section>
`

const renderCall = (call) => {
  const side = sideLabel(call.outcome)
  const status = call.result || call.state
  const isLive = call.backing?.available
  const resultClass = call.result === 'Won' ? 'status-won' : call.result === 'Lost' ? 'status-lost' : ''
  return `
    <main class="public-shell">
      ${topBar('Public Call')}
      <section class="call-stage">
        <div class="call-stage__meta">
          <div><span class="asset-chip">${escapeHTML(call.asset)}</span><span class="interval-chip">${escapeHTML(call.interval || 'Live')}</span></div>
          <span class="call-status ${resultClass}">${escapeHTML(status)}</span>
        </div>

        <div class="call-stage__headline">
          <span class="call-side call-side--${side.toLowerCase()}">${side}</span>
          <h1>${escapeHTML(call.question)}</h1>
        </div>

        <div class="call-metrics">
          <div><span>Entry</span><strong>${formatProbability(call.entryProbability)}</strong></div>
          <div><span>${isLive ? 'Current' : 'Result'}</span><strong>${isLive ? formatProbability(call.currentProbability) : escapeHTML(call.result || 'Pending')}</strong></div>
          <div><span>Filled</span><strong>${escapeHTML(call.filledQuantity)}</strong></div>
          <div><span>${isLive ? 'Closes in' : 'Window'}</span><strong data-expiry="${escapeHTML(call.expiry)}">${isLive ? formatTimeRemaining(call.expiry) : 'Settled'}</strong></div>
        </div>

        <div class="call-byline">
          <span>Made ${escapeHTML(new Date(call.createdAt).toLocaleDateString())}</span>
          <span>Verified Velo Call</span>
        </div>
      </section>

      <div class="call-actions">
        ${isLive ? '<button class="primary-action back-trigger" type="button">Back this Call</button>' : ''}
        <button class="secondary-action share-trigger" type="button">Share</button>
        <button class="secondary-action copy-trigger" type="button">Copy link</button>
        <button class="secondary-action proof-trigger" type="button">View proof</button>
      </div>

      <div id="back-panel"></div>
      <div id="proof-panel" hidden></div>

      ${call.successor ? `<a class="next-call" href="/call/${encodeURIComponent(call.successor.id)}"><span>Next in this series</span><strong>Open the next ${escapeHTML(call.successor.asset)} Call</strong></a>` : ''}
    </main>
  `
}

let backingMarketId

const handleBack = async (call) => {
  const trigger = document.querySelector('.back-trigger')
  trigger.disabled = true
  trigger.textContent = 'Loading offer'
  try {
    const entries = await listVerifiedLiveMarkets()
    const entry = entries.find(({ market }) => market.marketId.toLowerCase() === call.backing.key.toLowerCase())
    if (!entry) throw new Error('This Call is no longer live.')

    const book = await getBinaryBook(entry.market)
    const yes = book?.yesAsks?.[0] ? probabilityPercent(book.yesAsks[0].price, entry.market.quoteDecimals) : null
    const no = book?.noAsks?.[0] ? probabilityPercent(book.noAsks[0].price, entry.market.quoteDecimals) : null
    backingMarketId = entry.market.marketId

    const panel = document.querySelector('#back-panel')
    panel.innerHTML = `
      <section class="back-box">
        <div class="section-heading"><span>Back this Call</span><h2>Take your own position</h2></div>
        <form id="back-form">
          <div class="back-sides">
            <label><input type="radio" name="outcome" value="0" checked><span>Higher</span><strong>${formatProbability(yes)}</strong></label>
            <label><input type="radio" name="outcome" value="1"><span>Lower</span><strong>${formatProbability(no)}</strong></label>
          </div>
          <label class="back-amount"><span>Contracts</span><input type="number" name="amount" min="0" step="any" inputmode="decimal" placeholder="0.00" required></label>
          <button class="primary-action" type="submit">Continue in wallet</button>
        </form>
      </section>
    `
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    document.querySelector('#back-form').addEventListener('submit', async (event) => {
      event.preventDefault()
      const button = event.currentTarget.querySelector('button[type="submit"]')
      button.disabled = true
      button.textContent = 'Preparing wallet'
      try {
        if (!getConnectedWallet()) await connectWallet()
        const data = new FormData(event.currentTarget)
        button.textContent = 'Confirm in wallet'
        const result = await publishCall({
          marketId: backingMarketId,
          outcome: Number(data.get('outcome')),
          amount: data.get('amount'),
        })
        button.textContent = 'Saving Call'
        const record = await persistCall(result)
        window.location.href = `/call/${encodeURIComponent(record.id)}`
      } catch (error) {
        button.disabled = false
        button.textContent = 'Continue in wallet'
        showToast('Call not created', error instanceof Error ? error.message : 'The transaction could not be completed.')
      }
    })
    trigger.remove()
  } catch (error) {
    trigger.disabled = false
    trigger.textContent = 'Back this Call'
    showToast('Backing unavailable', error instanceof Error ? error.message : 'The current offer could not be loaded.')
  }
}

const tickPublicCountdown = () => {
  document.querySelectorAll('[data-expiry]').forEach((element) => {
    if (element.textContent === 'Settled') return
    element.textContent = formatTimeRemaining(element.dataset.expiry)
  })
}

const loadCall = async () => {
  document.querySelector('#app').innerHTML = '<div class="public-loading-v2">Loading Call</div>'
  try {
    const call = await getPublicCall(callId)
    document.title = `${call.asset} ${sideLabel(call.outcome)} | Velo`
    document.querySelector('#app').innerHTML = renderCall(call)

    document.querySelector('.back-trigger')?.addEventListener('click', () => handleBack(call))
    const url = window.location.href
    document.querySelector('.share-trigger').addEventListener('click', async () => {
      if (navigator.share) {
        await navigator.share({ title: document.title, text: `${call.asset} ${sideLabel(call.outcome)} is on the record.`, url }).catch(() => {})
      } else {
        try {
          await navigator.clipboard.writeText(url)
          showToast('Link copied', 'The public Call is ready to share.')
        } catch {
          showToast('Share unavailable', 'Copy the URL from your browser.')
        }
      }
    })
    document.querySelector('.copy-trigger').addEventListener('click', async (event) => {
      try {
        await navigator.clipboard.writeText(url)
        event.currentTarget.textContent = 'Copied'
        showToast('Link copied', 'The public Call is ready to share.')
      } catch {
        showToast('Copy unavailable', 'Copy the URL from your browser.')
      }
    })
    document.querySelector('.proof-trigger').addEventListener('click', async (event) => {
      const button = event.currentTarget
      button.disabled = true
      button.textContent = 'Loading proof'
      try {
        const proof = await getPublicCall(callId, true)
        const panel = document.querySelector('#proof-panel')
        panel.hidden = false
        panel.innerHTML = renderProof(proof)
        button.remove()
      } catch (error) {
        button.disabled = false
        button.textContent = 'View proof'
        showToast('Proof unavailable', error instanceof Error ? error.message : 'Proof could not be loaded.')
      }
    })

    tickPublicCountdown()
    window.setInterval(tickPublicCountdown, 1000)
  } catch (error) {
    document.querySelector('#app').innerHTML = renderError(error instanceof Error ? error.message : 'The public Call could not be found.')
  }
}

const renderProfileCall = (call) => `
  <a class="profile-call-v2" href="/call/${encodeURIComponent(call.id)}">
    <span class="profile-call-v2__state">${escapeHTML(call.result || call.state)}</span>
    <div><strong>${escapeHTML(call.asset)} ${sideLabel(call.outcome)}</strong><span>${escapeHTML(call.interval || 'Live window')} · entered ${formatProbability(call.entryProbability)}</span></div>
    <span>View</span>
  </a>
`

const renderClaimable = (positions) => {
  if (!positions.length) return `<div class="profile-empty-v2"><strong>Nothing to claim right now.</strong><span>Winning positions will appear here after settlement.</span></div>`
  return positions.map((position, index) => `
    <div class="claim-row">
      <div><strong>${escapeHTML(position.outcome === 'Yes' ? 'Higher' : 'Lower')} position</strong><span>${escapeHTML(position.marketId.slice(0, 10))}...${escapeHTML(position.marketId.slice(-6))}</span></div>
      <button class="claim-trigger" type="button" data-claim-index="${index}">Claim winnings</button>
    </div>
  `).join('')
}

const renderProfile = (profile, claimable) => {
  const active = profile.calls.filter((call) => call.state === 'Live' && !call.result)
  const settled = profile.calls.filter((call) => call.result || call.state !== 'Live')
  const accuracy = profile.accuracy === null ? '—' : `${profile.accuracy.toFixed(1)}%`

  return `
    <main class="public-shell">
      ${topBar('Trader profile')}

      <section class="profile-hero-v2">
        <div class="profile-avatar-v2">v</div>
        <div>
          <span>Public Velo</span>
          <h1>${shortAddress(profile.walletAddress)}</h1>
          <p>A record built from confirmed Calls.</p>
        </div>
        <a href="/app">Make a Call</a>
      </section>

      <section class="profile-stats-v2">
        <div><span>Public Calls</span><strong>${profile.calls.length}</strong></div>
        <div><span>Settled</span><strong>${profile.settledCalls}</strong></div>
        <div><span>Accuracy</span><strong>${accuracy}</strong></div>
        <div><span>Live now</span><strong>${active.length}</strong></div>
      </section>

      <section class="profile-section-v2">
        <div class="section-heading"><span>Open positions</span><h2>Live Calls</h2></div>
        <div class="profile-list-v2">
          ${active.length ? active.map(renderProfileCall).join('') : '<div class="profile-empty-v2"><strong>No live Calls.</strong><span>New Calls appear here while their market window is open.</span></div>'}
        </div>
      </section>

      <section class="profile-section-v2">
        <div class="section-heading"><span>Settlement</span><h2>Claimable</h2></div>
        <div class="claim-list">${renderClaimable(claimable)}</div>
      </section>

      <section class="profile-section-v2">
        <div class="section-heading"><span>History</span><h2>Receipts</h2></div>
        <div class="profile-list-v2">
          ${settled.length ? settled.map(renderProfileCall).join('') : '<div class="profile-empty-v2"><strong>No settled Calls yet.</strong><span>Your completed record will build here over time.</span></div>'}
        </div>
      </section>
    </main>
  `
}

const attachClaimHandlers = (profile, claimable) => {
  document.querySelectorAll('[data-claim-index]').forEach((button) => {
    button.addEventListener('click', async () => {
      const position = claimable[Number(button.dataset.claimIndex)]
      button.disabled = true
      button.textContent = 'Preparing wallet'
      try {
        let connected = getConnectedWallet()
        if (!connected) connected = await connectWallet()
        if (connected.toLowerCase() !== profile.walletAddress.toLowerCase()) {
          throw new Error(`Connect ${shortAddress(profile.walletAddress)} to claim this position.`)
        }
        button.textContent = 'Confirm in wallet'
        await redeemClaimablePosition(position)
        button.textContent = 'Claimed'
        showToast('Winnings claimed', 'The redemption transaction was submitted successfully.')
      } catch (error) {
        button.disabled = false
        button.textContent = 'Claim winnings'
        showToast('Claim unavailable', error instanceof Error ? error.message : 'The position could not be claimed.')
      }
    })
  })
}

const loadProfile = async () => {
  document.querySelector('#app').innerHTML = '<div class="public-loading-v2">Loading profile</div>'
  try {
    const [profile, claimable] = await Promise.all([
      getPublicProfile(profileAddress),
      getClaimablePositions(profileAddress).catch(() => []),
    ])
    document.title = `${shortAddress(profile.walletAddress)} | Velo`
    document.querySelector('#app').innerHTML = renderProfile(profile, claimable)
    attachClaimHandlers(profile, claimable)
  } catch (error) {
    document.querySelector('#app').innerHTML = renderError(error instanceof Error ? error.message : 'The public Velo profile could not be found.')
  }
}

if (callId) loadCall()
else if (profileAddress) loadProfile()
else document.querySelector('#app').innerHTML = renderError('Choose a public Call or profile URL to continue.')
