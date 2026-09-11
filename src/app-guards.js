const MIN_TRADE_SECONDS = 45

const secondsFromNode = (node) => {
  const expiry = Number(node?.dataset?.expiry)
  if (!Number.isFinite(expiry)) return Infinity
  return expiry - Math.floor(Date.now() / 1000)
}

const refreshClosingWindows = () => {
  document.querySelectorAll('.market-card-v4, .market-list-row').forEach((card) => {
    const timer = card.querySelector('[data-expiry]')
    const button = card.querySelector('[data-open-market]')
    if (!timer || !button || button.textContent === 'Waiting') return
    const closing = secondsFromNode(timer) < MIN_TRADE_SECONDS
    button.disabled = closing
    if (closing) button.textContent = 'Closing'
    else if (button.textContent === 'Closing') button.textContent = 'Open Call'
  })
}

const explainFirstApproval = () => {
  const note = document.querySelector('.collateral-note span')
  if (!note || note.dataset.approvalExplained) return
  note.dataset.approvalExplained = '1'
  note.append(document.createTextNode(' First trade on a pool may ask for an approval, then the order.'))
}

const observer = new MutationObserver(() => {
  refreshClosingWindows()
  explainFirstApproval()
})
observer.observe(document.querySelector('#app') || document.body, { childList: true, subtree: true })
refreshClosingWindows()
setInterval(refreshClosingWindows, 1000)
