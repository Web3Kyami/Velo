import './styles.css'
import {
  getPublicCall,
  getPublicProfile,
  getConnectedWallet,
  listVerifiedLiveMarkets,
  getBinaryBook,
  connectWallet,
  persistCall,
  publishCall,
  networkLabel,
  probabilityPercent,
} from './dreamdex.js'

document.body.className = 'public-body'

const arrow = '<span class="arrow" aria-hidden="true">↗</span>'
const escapeHTML = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
const formatProbability = (value) => value === null || value === undefined ? 'No trade yet' : `${Number(value).toFixed(1)}%`
const formatTimeRemaining = (expiry) => {
  const seconds = Math.max(0, Number(expiry) - Math.floor(Date.now() / 1000))
  if (seconds <= 0) return 'Window closed'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m left` : `${minutes}m ${String(seconds % 60).padStart(2, '0')}s left`
}
const shortAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`
const callId = window.location.pathname.match(/^\/call\/([a-f0-9]{24})$/i)?.[1]
const profileAddress = window.location.pathname.match(/^\/profile\/(0x[a-f0-9]{40})$/i)?.[1]

const pageTop = (label) => `<div class="public-top"><a class="logo" href="/"><span class="logo-mark">v</span><span>velo</span></a><span class="public-top__label">${escapeHTML(label)}</span></div>`
const renderError = (message) => `<main class="public-page">${pageTop('Public Velo')}<section class="public-intro"><p class="kicker">Record unavailable</p><h1>This page<br /><i>is not here.</i></h1><p>${escapeHTML(message)}</p><a class="button button--dark" href="/">Return home ${arrow}</a></section></main>`

const renderProof = (payload) => `<section class="proof-panel"><div class="proof-panel__inner"><p class="kicker"><span class="kicker-dot"></span> View proof</p><h2>Check the receipt.</h2><dl><div><dt>Transaction</dt><dd><a href="${escapeHTML(payload.proof.url)}" target="_blank" rel="noreferrer">${escapeHTML(payload.proof.transactionHash.slice(0, 10))}...${escapeHTML(payload.proof.transactionHash.slice(-8))} ${arrow}</a></dd></div><div><dt>Market ID</dt><dd>${escapeHTML(payload.proof.marketId)}</dd></div><div><dt>Fill block</dt><dd>${escapeHTML(payload.proof.fillBlockNumber)}</dd></div><div><dt>Verified at</dt><dd>${escapeHTML(payload.proof.verifiedAt)}</dd></div></dl>${payload.proof.resolutionTransactionHash ? `<p class="proof-panel__resolution">Resolution receipt: ${escapeHTML(payload.proof.resolutionTransactionHash)}</p>` : ''}<a class="text-link" href="/profile/${encodeURIComponent(payload.proof.walletAddress)}">View this trader's record ${arrow}</a></div></section>`

const renderCall = (call) => `
  <main class="public-page" id="public-call">
    ${pageTop('Public Call')}
    <section class="public-call-intro"><div><p class="kicker"><span class="kicker-dot"></span> ${escapeHTML(call.result || call.state)} call</p><h1>A view<br /><i>on the record.</i></h1></div><p class="public-call-intro__lede">A public Call with a real position behind it.</p></section>
    <article class="call-record">
      <div class="call-record__top"><span>${escapeHTML(call.asset)} / ${escapeHTML(call.interval || 'Live window')}</span><span>${escapeHTML(call.state)}</span></div>
      <div class="call-record__question"><span>THE CALL</span><h2>${escapeHTML(call.question)}</h2></div>
      <div class="call-record__metrics"><div><span>Side</span><strong>${escapeHTML(call.outcome)}</strong></div><div><span>Entry probability</span><strong>${formatProbability(call.entryProbability)}</strong></div><div><span>Current probability</span><strong>${formatProbability(call.currentProbability)}</strong></div><div><span>Result</span><strong>${escapeHTML(call.result || 'Pending')}</strong></div><div><span>Contracts</span><strong>${escapeHTML(call.filledQuantity)}</strong></div><div><span>Time</span><strong>${formatTimeRemaining(call.expiry)}</strong></div></div>
      <div class="call-record__bottom"><span>Created ${escapeHTML(new Date(call.createdAt).toLocaleDateString())}</span><span>Public record</span></div>
    </article>
    ${call.successor ? `<div class="successor"><span>Next in this series</span><a href="/call/${encodeURIComponent(call.successor.id)}">Open the next Call ${arrow}</a></div>` : ''}
    <div class="public-actions">${call.backing?.available ? '<button class="button button--dark public-back-trigger" type="button">Back this Call ' + arrow + '</button>' : ''}<button class="button button--outline public-copy-trigger" type="button">Copy link</button><button class="button button--outline public-share-trigger" type="button">Share ${arrow}</button><button class="button button--outline public-proof-trigger" type="button">View proof ${arrow}</button></div>
    <div id="public-proof" hidden></div><div id="public-back-panel"></div>
    <a class="text-link public-own-link" href="/app">Make your own Call ${arrow}</a>
  </main>`

const renderProfile = (profile) => {
  const calls = profile.calls.length ? profile.calls.map((call) => `<a class="profile-call" href="/call/${encodeURIComponent(call.id)}"><span class="profile-call__state">${escapeHTML(call.result || call.state)}</span><span class="profile-call__copy"><strong>${escapeHTML(call.outcome)} / ${escapeHTML(call.asset)}</strong><span>${escapeHTML(call.question)}</span></span><span>${formatProbability(call.entryProbability)}</span>${arrow}</a>`).join('') : '<div class="profile-empty"><span class="profile-empty__mark">+</span><div><h2>No Calls yet.</h2><p>This record starts when a real Call is made and confirmed.</p><a class="text-link" href="/app">Make the first Call ' + arrow + '</a></div></div>'
  return `<main class="public-page public-profile"><div>${pageTop('Public Velo')}</div><section class="public-profile-intro"><p class="kicker"><span class="kicker-dot"></span> Public record</p><h1>Calls that<br /><i>stay visible.</i></h1><p>Confirmed Calls from <span>${escapeHTML(networkLabel)}</span>.</p></section><section class="profile-identity"><span class="profile-avatar">v</span><div><span>Wallet record</span><strong>${shortAddress(profile.walletAddress)}</strong></div></section><section class="profile-summary"><div><span>Settled Calls</span><strong>${profile.settledCalls}</strong></div><div><span>Accuracy</span><strong>${profile.accuracy === null ? 'Not yet' : `${profile.accuracy.toFixed(1)}%`}</strong></div><div><span>Public Calls</span><strong>${profile.calls.length}</strong></div></section><section class="profile-history"><div class="profile-history__head"><h2>Call history</h2><span>${profile.calls.length} recorded</span></div><div class="profile-call-list">${calls}</div></section></main>`
}

let toast
let toastTimer
const showToast = (title, message) => {
  if (!toast) { toast = document.createElement('div'); toast.className = 'public-toast'; document.body.append(toast) }
  toast.innerHTML = `<strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span>`
  toast.classList.add('public-toast--visible')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toast.classList.remove('public-toast--visible'), 6000)
}

let backingMarketId
const handleBacking = async (event, call) => {
  const button = event.currentTarget
  button.disabled = true
  button.textContent = 'Reading current offer'
  try {
    const entries = await listVerifiedLiveMarkets()
    const entry = entries.find(({ market }) => market.marketId.toLowerCase() === call.backing.key.toLowerCase())
    if (!entry) throw new Error('This Call is no longer live. Refresh the record to see its current state.')
    const book = await getBinaryBook(entry.market)
    const yes = book?.yesAsks?.[0] ? probabilityPercent(book.yesAsks[0].price, entry.market.quoteDecimals) : null
    const no = book?.noAsks?.[0] ? probabilityPercent(book.noAsks[0].price, entry.market.quoteDecimals) : null
    backingMarketId = entry.market.marketId
    document.querySelector('#public-back-panel').innerHTML = `<section class="back-panel"><p class="kicker"><span class="kicker-dot"></span> Back this Call</p><h2>Take your own side.</h2><p>Your Call will be an independent position from your wallet.</p><form id="back-form" class="back-form"><fieldset><legend>Choose your side</legend><label><input type="radio" name="outcome" value="0" checked /> Higher <span>${formatProbability(yes)} offer</span></label><label><input type="radio" name="outcome" value="1" /> Lower <span>${formatProbability(no)} offer</span></label></fieldset><label class="back-form__amount">Amount in contracts<input type="number" name="amount" min="0" step="any" inputmode="decimal" required /></label><button class="button button--dark" type="submit">Back this Call ${arrow}</button></form></section>`
    document.querySelector('#back-form').addEventListener('submit', async (submitEvent) => {
      submitEvent.preventDefault()
      const submit = submitEvent.currentTarget.querySelector('button')
      if (!getConnectedWallet()) { showToast('Connect wallet first', `Connect a wallet on ${networkLabel} before backing a Call.`); return }
      submit.disabled = true; submit.textContent = 'Confirming transaction'
      try {
        const formData = new FormData(submitEvent.currentTarget)
        const result = await publishCall({ marketId: backingMarketId, outcome: Number(formData.get('outcome')), amount: formData.get('amount') })
        const record = await persistCall(result)
        window.location.href = `/call/${encodeURIComponent(record.id)}`
      } catch (error) { showToast('Call not created', error instanceof Error ? error.message : 'The transaction could not be confirmed.'); submit.disabled = false; submit.textContent = `Back this Call ${arrow}` }
    })
  } catch (error) { showToast('Backing unavailable', error instanceof Error ? error.message : 'The current offer could not be loaded.'); button.disabled = false; button.textContent = `Back this Call ${arrow}` }
}

const loadCall = async () => {
  document.querySelector('#app').innerHTML = '<div class="public-loading">Reading public Call</div>'
  try {
    const call = await getPublicCall(callId)
    document.title = `${call.result || call.outcome} Call | Velo`
    document.querySelector('#app').innerHTML = renderCall(call)
    document.querySelector('.public-back-trigger')?.addEventListener('click', (event) => handleBacking(event, call))
    const url = window.location.href
    document.querySelector('.public-copy-trigger')?.addEventListener('click', async (event) => { try { await navigator.clipboard.writeText(url); event.currentTarget.textContent = 'Link copied'; showToast('Link copied', 'Your public Call link is ready to share.') } catch { showToast('Copy unavailable', 'Select the URL in your browser to share this Call.') } })
    document.querySelector('.public-share-trigger')?.addEventListener('click', async () => { if (navigator.share) await navigator.share({ title: document.title, text: `${call.outcome} on the record`, url }).catch(() => {}); else { try { await navigator.clipboard.writeText(url); showToast('Link copied', 'Your public Call link is ready to share.') } catch { showToast('Share unavailable', 'Select the URL in your browser to share this Call.') } } })
    document.querySelector('.public-proof-trigger')?.addEventListener('click', async (event) => { const button = event.currentTarget; button.disabled = true; button.textContent = 'Reading proof'; try { const proof = await getPublicCall(callId, true); document.querySelector('#public-proof').hidden = false; document.querySelector('#public-proof').innerHTML = renderProof(proof); button.remove() } catch (error) { showToast('Proof unavailable', error instanceof Error ? error.message : 'The proof could not be loaded.'); button.disabled = false; button.textContent = `View proof ${arrow}` } })
  } catch (error) { document.querySelector('#app').innerHTML = renderError(error instanceof Error ? error.message : 'The public Call could not be found.') }
}
const loadProfile = async () => {
  document.querySelector('#app').innerHTML = '<div class="public-loading">Reading public record</div>'
  try { document.querySelector('#app').innerHTML = renderProfile(await getPublicProfile(profileAddress)) } catch (error) { document.querySelector('#app').innerHTML = renderError(error instanceof Error ? error.message : 'The public Velo record could not be found.') }
}

if (callId) loadCall()
else if (profileAddress) loadProfile()
else document.querySelector('#app').innerHTML = renderError('Choose a public Call or profile URL to continue.')
