import { warmOrderMarkets } from './dreamdex.js'
import { getMarketProbabilitySeries, sparklineMarkup } from './market-charts.js'

const updateCardChart = (marketId, series) => {
  const button = document.querySelector(`[data-open-market="${CSS.escape(marketId)}"]`)
  const card = button?.closest('.market-card-v4')
  const current = card?.querySelector('.card-sparkline-v4')
  if (!current) return
  current.outerHTML = sparklineMarkup(series, 'card-sparkline-v4', 210, 42)
}

window.addEventListener('velo:chart-ready', (event) => {
  const { marketId, series } = event.detail || {}
  if (!marketId) return
  updateCardChart(marketId, Array.isArray(series) ? series : [])
})

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-market]')
  if (!button) return
  const marketId = button.dataset.openMarket

  warmOrderMarkets().catch(() => {})

  window.setTimeout(async () => {
    const series = await getMarketProbabilitySeries(marketId, true).catch(() => [])
    const current = document.querySelector('.modal-sparkline-v4')
    if (!current) return
    current.outerHTML = sparklineMarkup(series, 'modal-sparkline-v4', 520, 72)
  }, 0)
}, { capture: true })
