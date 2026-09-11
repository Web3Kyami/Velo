import './landing.css'

const icon = (name) => ({
  market: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.7 2.5 4 5.1 4 8s-1.3 5.5-4 8c-2.7-2.5-4-5.1-4-8s1.3-5.5 4-8Z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.7 2.9 8.2 7 10 4.1-1.8 7-5.3 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-4 3.3-6 7-6s6.3 2 7 6"/></svg>',
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></svg>',
  receipt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></svg>',
  chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18V9M9 18V5M14 18v-7M19 18V3"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h12"/><path d="M16 12h4v4h-4a2 2 0 0 1 0-4Z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5"/></svg>',
}[name] || '')

const brand = (mini = false) => `<span class="${mini ? 'mini-old-velo-mark' : 'old-velo-mark-landing'}">v</span><strong>velo</strong>`

document.body.className = 'landing-body landing-body-v2'
document.title = 'Velo — Put your calls on the record'

document.querySelector('#app').innerHTML = `
  <header class="landing-nav-v2">
    <a class="landing-brand-v2" href="/" aria-label="Velo home">${brand()}</a>
    <nav aria-label="Primary navigation">
      <a href="/app">Markets</a>
      <a href="#how-it-works">How it works</a>
      <a href="#why-velo">Why Velo</a>
      <a href="#faq">FAQ</a>
    </nav>
    <a class="nav-cta-v2" href="/app">Open Velo <span>→</span></a>
  </header>

  <main>
    <section class="hero-v2">
      <div class="hero-copy-v2">
        <span class="hero-pill-v2"><i>✦</i> PREDICT. TRADE. PROVE.</span>
        <h1>Put your calls <span>on the record.</span></h1>
        <p>Velo turns real DreamDEX positions into public market Calls. Go Higher or Lower on BTC and ETH, trade with tUSDC, and keep a verifiable record of every confirmed Call.</p>
        <div class="hero-actions-v2">
          <a class="primary-cta-v2" href="/app">Open Velo <span>→</span></a>
          <a class="secondary-cta-v2" href="#how-it-works"><span class="play-dot">▶</span> How it works</a>
        </div>
        <div class="hero-points-v2">
          <div><span>${icon('market')}</span><p>Real markets<br><small>BTC & ETH</small></p></div>
          <div><span>${icon('shield')}</span><p>Onchain &<br><small>verifiable</small></p></div>
          <div><span>${icon('profile')}</span><p>Build your<br><small>public record</small></p></div>
        </div>
      </div>

      <div class="hero-visual-v2" aria-label="Illustrative Velo market Call becoming a receipt">
        <div class="visual-orb visual-orb--blue"></div>
        <div class="visual-orb visual-orb--purple"></div>
        <div class="rock rock--btc"><span>₿</span></div>
        <div class="rock rock--eth"><span>◆</span></div>

        <article class="preview-card trade-preview">
          <div class="preview-topline"><div><span class="asset-dot asset-dot--btc">₿</span><strong>BTC</strong><em>1H</em></div><span class="preview-example">Illustrative</span></div>
          <div class="preview-chart-wrap">
            <svg viewBox="0 0 320 120" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#20f2c1" stop-opacity=".28"/><stop offset="1" stop-color="#20f2c1" stop-opacity="0"/></linearGradient></defs>
              <path class="preview-grid" d="M0 30H320M0 60H320M0 90H320M64 0V120M128 0V120M192 0V120M256 0V120"/>
              <path class="preview-area" d="M0 96 L18 80 L31 87 L49 69 L68 72 L84 56 L100 63 L116 44 L131 52 L149 39 L164 47 L184 29 L199 42 L218 25 L237 33 L251 21 L268 29 L286 16 L304 22 L320 10 L320 120 L0 120 Z"/>
              <path class="preview-line" d="M0 96 L18 80 L31 87 L49 69 L68 72 L84 56 L100 63 L116 44 L131 52 L149 39 L164 47 L184 29 L199 42 L218 25 L237 33 L251 21 L268 29 L286 16 L304 22 L320 10"/>
            </svg>
          </div>
          <h3>Will BTC be higher or lower in 1 hour?</h3>
          <div class="preview-sides"><div class="preview-side preview-side--up"><span>↑</span><b>Higher</b><strong>52%</strong></div><div class="preview-side preview-side--down"><span>↓</span><b>Lower</b><strong>48%</strong></div></div>
          <label class="preview-stake"><span>Amount (tUSDC)</span><div><strong>10</strong><em>MAX</em></div></label>
          <button type="button" tabindex="-1">Publish Call</button>
        </article>

        <svg class="stage-arrow-v2" viewBox="0 0 120 90" aria-hidden="true"><path d="M8 18c46-14 75 3 82 38"/><path d="m79 48 12 11 9-13"/></svg>
        <p class="stage-note-v2">From a call<br>to a receipt.<br><strong>Always verifiable.</strong></p>

        <article class="preview-card receipt-preview">
          <div class="receipt-head-v2"><a class="mini-brand" href="/" tabindex="-1">${brand(true)}</a><span class="won-pill">WON</span></div>
          <div class="receipt-market-v2"><span class="asset-dot asset-dot--btc">₿</span><div><strong>BTC 1H</strong><small>Higher</small></div></div>
          <dl>
            <div><dt>Entry probability</dt><dd>52%</dd></div>
            <div><dt>Position</dt><dd>10 tUSDC</dd></div>
            <div><dt>Result</dt><dd>Won</dd></div>
            <div><dt>Tx hash</dt><dd>0x3a...7f2c</dd></div>
          </dl>
          <div class="verified-row-v2"><span>✓</span><div><strong>Verified onchain</strong><small>Real market. Real position.</small></div></div>
        </article>
      </div>
    </section>

    <section class="trust-strip-v2" aria-label="Velo highlights">
      <div><span>${icon('coin')}</span><p><strong>Trade with tUSDC</strong><small>Real collateral on testnet.</small></p></div>
      <div><span>${icon('profile')}</span><p><strong>Public profiles</strong><small>Build a record over time.</small></p></div>
      <div><span>${icon('receipt')}</span><p><strong>Transparent results</strong><small>Every Call keeps its proof.</small></p></div>
      <div><span class="infinity-mark">∞</span><p><strong>Powered by DreamDEX</strong><small>Real liquidity. Real markets.</small></p></div>
    </section>

    <section class="loop-v2" id="how-it-works">
      <div class="loop-heading-v2"><span>HOW VELO WORKS</span><h2>A simple loop. <em>Real impact.</em></h2><p>Predict. Trade. Settle. Build your record.</p></div>
      <div class="loop-grid-v2">
        <article><span class="step-icon">${icon('chart')}</span><b>01</b><h3>Make a call</h3><p>Choose BTC or ETH, pick a live window, and decide Higher or Lower.</p></article>
        <article><span class="step-icon">${icon('wallet')}</span><b>02</b><h3>Trade onchain</h3><p>Use your wallet to take a real DreamDEX Event Contract position.</p></article>
        <article><span class="step-icon">${icon('receipt')}</span><b>03</b><h3>Get a receipt</h3><p>Velo verifies the fill and creates a shareable Call with proof attached.</p></article>
        <article><span class="step-icon">${icon('profile')}</span><b>04</b><h3>Build your record</h3><p>Once markets settle, receipts stay on your public trader profile.</p></article>
      </div>
    </section>

    <section class="proof-section-v2" id="why-velo">
      <div class="proof-copy-v2"><span>WHY VELO</span><h2>A market opinion is stronger when the position is visible.</h2><p>Posts and screenshots are easy to make after the fact. Velo connects the public Call to a confirmed position, then keeps the result attached to the same record.</p><a href="/app">Explore live markets ${icon('arrow')}</a></div>
      <div class="proof-card-v2">
        <div class="proof-card-title"><span>${icon('shield')}</span><div><strong>Proof travels with the Call</strong><small>Transaction, fill, market and outcome stay connected.</small></div></div>
        <div class="proof-flow-v2"><span>Call created</span><i></i><span>Shared live</span><i></i><span>Settled receipt</span><i></i><span>Public record</span></div>
      </div>
    </section>

    <section class="faq-v2" id="faq">
      <div><span>FAQ</span><h2>Built around real positions.</h2></div>
      <div class="faq-list-v2">
        <details><summary>Is Velo a prediction market?</summary><p>DreamDEX provides the underlying Event Contract market. Velo is the public identity and proof layer around a trader's real position.</p></details>
        <details><summary>Does Back this Call copy a trade automatically?</summary><p>No. Backing a Call creates a new independent position at the price available when the second trader acts.</p></details>
        <details><summary>What do I trade with?</summary><p>The current Somnia testnet build uses tUSDC as Event Contract collateral. STT is used for gas.</p></details>
      </div>
    </section>

    <section class="final-cta-v2">
      <div><span>MAKE THE CALL. KEEP THE PROOF.</span><h2>Put your next call on the record.</h2></div>
      <a href="/app">Open Velo <span>→</span></a>
    </section>
  </main>

  <footer class="landing-footer-v2"><a class="landing-brand-v2" href="/">${brand()}</a><span>Built on Somnia · Powered by DreamDEX Event Contracts</span></footer>
`
