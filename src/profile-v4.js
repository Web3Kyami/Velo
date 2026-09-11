import './profile-v4.css'
import {
  collateralDecimals,
  collateralSymbol,
  connectWallet,
  getClaimablePositions,
  getConnectedWallet,
  getPublicCall,
  getPublicProfile,
  redeemClaimablePosition,
} from './dreamdex.js'
import { getProfileMetadata, updateProfileDisplayName } from './profile-meta.js'
import { getMarketProbabilitySeries, sparklineMarkup } from './market-charts.js'

const address = window.location.pathname.match(/^\/profile\/(0x[a-f0-9]{40})$/i)?.[1]
const escapeHTML = (value) => String(value ?? '').replace(/[&<>'\"]/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;' })[character])
const shortAddress = (value) => `${value.slice(0,6)}...${value.slice(-4)}`
const formatProbability = (value) => value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`
const sideLabel = (side) => String(side).toLowerCase() === 'yes' ? 'Higher' : 'Lower'
const normalizeInterval = (value) => String(value || 'Live').toUpperCase().replace(/\s+/g,'')
const secondsLeft = (expiry) => Math.max(0, Number(expiry) - Math.floor(Date.now()/1000))
const formatTime = (expiry) => { const s=secondsLeft(expiry); if(s<=0)return'Closed'; const m=Math.floor(s/60); return `${m}:${String(s%60).padStart(2,'0')}` }
const formatCollateralRaw = (raw) => { try { const v=BigInt(raw||'0'); const scale=10n**BigInt(collateralDecimals); const whole=v/scale; const fraction=(v%scale).toString().padStart(collateralDecimals,'0').replace(/0+$/,'').slice(0,2); return `${whole}${fraction?`.${fraction}`:''} ${collateralSymbol}` } catch { return `0 ${collateralSymbol}` } }

const icons = {
  market:'<svg viewBox="0 0 24 24"><path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/></svg>',
  profile:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-4 3.3-6 7-6s6.3 2 7 6"/></svg>',
  chart:'<svg viewBox="0 0 24 24"><path d="M4 19V9M9 19V5M14 19v-7M19 19V3"/></svg>',
  target:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v2M20 12h-2M12 20v-2M4 12h2"/></svg>',
  pulse:'<svg viewBox="0 0 24 24"><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>',
  receipt:'<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></svg>',
  coins:'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></svg>',
  copy:'<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>',
  edit:'<svg viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z"/><path d="m13.5 7 3.5 3.5"/></svg>',
}
const assetIcon=(asset)=>asset==='BTC'?'<span class="p-asset p-asset--btc">₿</span>':asset==='ETH'?'<span class="p-asset p-asset--eth"><svg viewBox="0 0 32 32"><path d="M16 3 8.5 16 16 20.2 23.5 16 16 3Z" fill="currentColor" stroke="none"/><path d="m8.5 17.5 7.5 11 7.5-11-7.5 4.2-7.5-4.2Z" fill="currentColor" stroke="none"/></svg></span>':`<span class="p-asset">${escapeHTML(String(asset).slice(0,1))}</span>`

let profile, metadata, claimable=[], seriesByCall=new Map(), toastTimer

document.body.className='profile-body-v3 profile-body-v4'
document.title='Profile | Velo'
const toast=document.createElement('div'); toast.className='profile-toast'; document.body.append(toast)
const showToast=(title,message)=>{toast.innerHTML=`<strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span>`;toast.classList.add('is-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('is-visible'),4400)}

const canEdit=async()=>{if(!window.ethereum)return false;try{const accounts=await window.ethereum.request({method:'eth_accounts'});return accounts?.[0]?.toLowerCase()===address.toLowerCase()}catch{return false}}
const avatarStyle=()=>{const hue=parseInt(address.slice(2,8),16)%360;return `--avatar-a:hsl(${hue} 72% 55%);--avatar-b:hsl(${(hue+55)%360} 76% 42%)`}

const top=()=>`<header class="profile-nav-v3"><a class="profile-brand-v3" href="/"><span>v</span><b>velo</b></a><nav><a href="/app">${icons.market}<span>Markets</span></a><a class="is-active" href="${window.location.pathname}">${icons.profile}<span>Profile</span></a></nav><span class="profile-wallet-v3"><i></i>${escapeHTML(shortAddress(address))}</span></header>`

const statCard=(icon,label,value,sub='',claim=false)=>`<div class="record-stat-v4 ${claim?'record-stat-v4--claim':''}"><span class="stat-icon-v4">${icon}</span><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong>${sub?`<em>${escapeHTML(sub)}</em>`:''}</div>`

const liveCard=(call)=>`<a class="live-call-card live-call-card-v4" href="/call/${encodeURIComponent(call.id)}"><div class="live-call-card__top"><div>${assetIcon(call.asset)}<strong>${escapeHTML(call.asset)}</strong><span>${escapeHTML(normalizeInterval(call.interval))}</span></div><em><i></i>Open</em></div>${sparklineMarkup(seriesByCall.get(call.id)||[],'profile-spark-v4',230,42)}<p>${escapeHTML(call.question)}</p><div class="live-call-card__bottom"><div class="call-side call-side--${call.outcome==='Yes'?'higher':'lower'}"><span>${sideLabel(call.outcome)}</span><strong>${formatProbability(call.entryProbability)}</strong></div><div class="call-time">${icons.clock}<span><small>Closes in</small><strong data-expiry="${escapeHTML(call.expiry)}">${formatTime(call.expiry)}</strong></span></div><div class="call-cost"><span>Position</span><strong>${escapeHTML(call.actualCost)} ${collateralSymbol}</strong></div></div></a>`

const receiptRow=(call)=>`<a class="receipt-row" href="/call/${encodeURIComponent(call.id)}"><span>${escapeHTML(new Date(call.createdAt).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}))}</span><div>${assetIcon(call.asset)}<strong>${escapeHTML(call.asset)}</strong><small>${escapeHTML(normalizeInterval(call.interval))}</small></div><span class="receipt-side receipt-side--${call.outcome==='Yes'?'higher':'lower'}">${sideLabel(call.outcome)}</span><span>${formatProbability(call.entryProbability)}</span><b class="receipt-result receipt-result--${String(call.result||'void').toLowerCase()}">${escapeHTML(call.result||'Void')}</b><span>${escapeHTML(call.actualCost)} ${collateralSymbol}</span></a>`

const claimList=()=>claimable.length?claimable.map((p,i)=>`<div class="claim-item"><div><strong>${p.outcome==='Yes'?'Higher':'Lower'} position</strong><span>${escapeHTML(p.marketId.slice(0,10))}...${escapeHTML(p.marketId.slice(-6))}</span></div><span>${formatCollateralRaw(p.estimatedPayoutRaw)}</span><button data-claim="${i}" type="button">Claim</button></div>`).join(''):'<div class="claim-empty">No winnings waiting to be claimed.</div>'

const render=async()=>{
 const calls=profile.calls||[]; const live=calls.filter(c=>c.state==='Live'&&!c.result); const receipts=calls.filter(c=>c.result||c.state!=='Live'); const accuracy=profile.accuracy===null?'—':`${profile.accuracy.toFixed(1)}%`; const total=claimable.reduce((s,p)=>s+BigInt(p.estimatedPayoutRaw||'0'),0n); const owner=await canEdit(); const name=metadata?.displayName||shortAddress(address)
 document.title=`${name} | Velo`
 document.querySelector('#app').innerHTML=`${top()}<main class="profile-shell-v3 profile-shell-v4"><section class="profile-title-v3"><h1>Profile</h1><p>Your record. Your Calls. Onchain.</p></section><section class="profile-overview-v3"><article class="identity-card-v3 identity-card-v4"><div class="address-avatar-v3" style="${avatarStyle()}"><span></span></div><div class="identity-copy-v4"><div class="identity-name-row"><strong>${escapeHTML(name)}</strong><button class="copy-address" type="button">${icons.copy}</button></div><span>${escapeHTML(shortAddress(address))}</span><small>${escapeHTML(address)}</small>${owner?`<button class="edit-profile-v4" type="button">${icons.edit}<span>Edit profile</span></button>`:''}</div></article><article class="record-card-v3 record-card-v4"><div class="record-card-v3__heading"><h2>Your record</h2><p>Real Calls. Real outcomes.</p></div><div class="record-stats-v3 record-stats-v4">${statCard(icons.chart,'Public Calls',String(calls.length))}${statCard(icons.target,'Accuracy',accuracy)}${statCard(icons.pulse,'Live Calls',String(live.length))}${statCard(icons.receipt,'Settled Receipts',String(profile.settledCalls))}${statCard(icons.coins,'Claimable Winnings',formatCollateralRaw(total.toString()),claimable.length?'Ready to claim':'Nothing due',true)}</div></article></section><section class="profile-section-card-v3"><div class="section-head-v3"><div><h2>Live Calls</h2><p>Your active positions, in real time.</p></div><a href="/app">${icons.plus}<span>Make a new Call</span></a></div><div class="live-calls-grid-v3">${live.length?live.map(liveCard).join(''):'<div class="profile-empty-card-v3"><strong>No live Calls yet.</strong><span>Open a market and publish your first Call.</span><a href="/app">Explore markets</a></div>'}</div></section><section class="profile-lower-v3"><article class="profile-section-card-v3 receipt-section-v3"><div class="section-head-v3"><div><h2>Settled Receipts</h2><p>Your recent Calls and results.</p></div></div>${receipts.length?`<div class="receipt-head"><span>Time</span><span>Market</span><span>Side</span><span>Entry prob</span><span>Outcome</span><span>Cost</span></div><div class="receipt-list-v3">${receipts.map(receiptRow).join('')}</div>`:'<div class="profile-empty-card-v3"><strong>No receipts yet.</strong><span>Your completed Calls will stay here.</span></div>'}</article><aside class="claim-card-v3" id="claim-section"><div class="section-head-v3"><div><h2>Claimable winnings</h2><p>Resolved positions ready for redemption.</p></div></div><div class="claim-list-v3">${claimList()}</div></aside></section></main><div class="profile-edit-modal" hidden><button class="profile-edit-backdrop" type="button"></button><form class="profile-edit-dialog"><button class="profile-edit-close" type="button">×</button><h2>Edit profile</h2><p>Choose the display name people see on your Calls and receipts.</p><label><span>Display name</span><input name="displayName" maxlength="24" value="${escapeHTML(metadata?.displayName||'')}" placeholder="Your name"></label><button class="profile-edit-save" type="submit">Save with wallet</button></form></div>`
 document.querySelector('.copy-address').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(address);showToast('Copied','Wallet address copied.')}catch{showToast('Copy unavailable','Copy the address from the page.')}})
 document.querySelector('.edit-profile-v4')?.addEventListener('click',openEditor)
 document.querySelector('.profile-edit-backdrop').addEventListener('click',closeEditor);document.querySelector('.profile-edit-close').addEventListener('click',closeEditor);document.querySelector('.profile-edit-dialog').addEventListener('submit',saveName)
 document.querySelectorAll('[data-claim]').forEach(btn=>btn.addEventListener('click',()=>claimPosition(Number(btn.dataset.claim),btn)))
 tick()
}

const openEditor=()=>{document.querySelector('.profile-edit-modal').hidden=false;document.body.classList.add('modal-open');document.querySelector('.profile-edit-dialog input').focus()}
const closeEditor=()=>{document.querySelector('.profile-edit-modal').hidden=true;document.body.classList.remove('modal-open')}
const saveName=async(event)=>{event.preventDefault();const button=event.currentTarget.querySelector('.profile-edit-save');button.disabled=true;button.textContent='Sign in wallet';try{metadata=await updateProfileDisplayName(address,new FormData(event.currentTarget).get('displayName'));showToast('Profile updated','Your display name is live.');await render()}catch(error){button.disabled=false;button.textContent='Save with wallet';showToast('Name not updated',error instanceof Error?error.message:'Try again.')}}
const claimPosition=async(index,button)=>{button.disabled=true;button.textContent='Connect';try{let connected=getConnectedWallet();if(!connected)connected=await connectWallet();if(connected.toLowerCase()!==address.toLowerCase())throw new Error(`Connect ${shortAddress(address)} to claim this position.`);button.textContent='Confirm';await redeemClaimablePosition(claimable[index]);button.textContent='Claimed';showToast('Claim submitted','Your redemption transaction was submitted.')}catch(error){button.disabled=false;button.textContent='Claim';showToast('Claim unavailable',error instanceof Error?error.message:'Try again.')}}
const tick=()=>document.querySelectorAll('[data-expiry]').forEach(node=>{node.textContent=formatTime(node.dataset.expiry)})

const loadSeries=async(live)=>{await Promise.all(live.slice(0,6).map(async(call)=>{try{const proof=await getPublicCall(call.id,true);const series=await getMarketProbabilitySeries(proof.proof.marketId);seriesByCall.set(call.id,series)}catch{seriesByCall.set(call.id,[])}}))}

const load=async()=>{if(!address){document.querySelector('#app').innerHTML='<main class="profile-error-v3"><h1>Profile unavailable</h1><a href="/app">Back to Markets</a></main>';return}document.querySelector('#app').innerHTML='<div class="profile-loading-v3">Loading profile</div>';try{[profile,metadata,claimable]=await Promise.all([getPublicProfile(address),getProfileMetadata(address).catch(()=>({displayName:null})),getClaimablePositions(address).catch(()=>[])]);await loadSeries((profile.calls||[]).filter(c=>c.state==='Live'&&!c.result));await render();setInterval(tick,1000)}catch(error){document.querySelector('#app').innerHTML=`${top()}<main class="profile-error-v3"><h1>Could not load this profile.</h1><p>${escapeHTML(error instanceof Error?error.message:'Try again shortly.')}</p><a href="/app">Back to Markets</a></main>`}}
load()
