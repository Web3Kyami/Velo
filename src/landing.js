import './landing.css'

document.body.classList.add('landing-mode')
document.title = 'Velo | Make the call. Keep the proof.'

const icon = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M10.5 4.5 16 10l-5.5 5.5"/></svg>'

document.querySelector('#app').innerHTML = `
  <div class="vl-page">
    <header class="vl-nav vl-shell">
      <a class="vl-brand" href="/"><span>V</span>velo</a>
      <nav aria-label="Primary">
        <a href="#how">How it works</a>
        <a href="#why">Why Velo</a>
      </nav>
      <a class="vl-button vl-button--dark" href="/app">Open Velo <i>${icon}</i></a>
    </header>

    <main>
      <section class="vl-hero vl-shell">
        <div class="vl-hero-copy">
          <p class="vl-kicker">VERIFIED MARKET IDENTITY</p>
          <h1>Make the call.<br><em>Keep the proof.</em></h1>
          <p class="vl-lede">Velo turns a live DreamDEX position into a public call you can share now and a permanent receipt when it settles.</p>
          <div class="vl-actions">
            <a class="vl-button vl-button--blue" href="/app">Make a real call <i>${icon}</i></a>
            <a class="vl-text-link" href="#how">See the loop</a>
          </div>
        </div>

        <div class="vl-object-wrap" aria-label="Illustration of a Velo Call">
          <div class="vl-object-caption"><span>PRODUCT FLOW</span><span>CALL → RECEIPT</span></div>
          <article class="vl-object">
            <div class="vl-object-top"><span class="vl-live"><b></b>Live call</span><span>BTC · 15M</span></div>
            <div class="vl-object-main">
              <small>YOUR VIEW, PUBLICLY TIMESTAMPED</small>
              <strong>HIGHER</strong>
              <p>The public object exists only after a confirmed DreamDEX fill. When the window settles, the same object becomes the receipt.</p>
            </div>
            <div class="vl-object-foot"><span>SHARE WHILE LIVE</span><span>KEEP AFTER SETTLEMENT</span></div>
          </article>
          <p class="vl-object-note">No seeded traders. No pretend win rates. A public record starts with a real position.</p>
        </div>
      </section>

      <section class="vl-loop" id="how">
        <div class="vl-shell vl-loop-grid">
          <article><span>01</span><h2>Call it.</h2><p>Choose a live BTC or ETH window and take the side you believe in.</p></article>
          <article><span>02</span><h2>Back it.</h2><p>Your Call is published only after your wallet confirms a real nonzero fill.</p></article>
          <article><span>03</span><h2>Share it.</h2><p>The live Call gets a public URL that anyone can open, even without a wallet.</p></article>
          <article><span>04</span><h2>Keep it.</h2><p>After settlement, the Call remains on your profile as part of your record.</p></article>
        </div>
      </section>

      <section class="vl-why vl-shell" id="why">
        <div class="vl-why-title">
          <p class="vl-kicker">THE PRODUCT IS THE RECORD</p>
          <h2>Not another trading terminal with a social tab.</h2>
        </div>
        <div class="vl-why-list">
          <div><span>Confirmed first</span><p>A Call is created from execution, not from a user typing a claim into a form.</p></div>
          <div><span>Useful while live</span><p>People can open your Call and take the same view while the market window is still open.</p></div>
          <div><span>Useful after settlement</span><p>The finished Call stays attached to your public history instead of disappearing with the live market.</p></div>
        </div>
      </section>

      <section class="vl-final vl-shell">
        <div><p class="vl-kicker">YOUR RECORD STARTS AT CALL ONE</p><h2>Put the next one<br>on the record.</h2></div>
        <a class="vl-button vl-button--blue vl-button--large" href="/app">Open Velo <i>${icon}</i></a>
      </section>
    </main>

    <footer class="vl-footer vl-shell">
      <a class="vl-brand" href="/"><span>V</span>velo</a>
      <span>Real position. Public record.</span>
      <a href="https://app.dreamdex.io/docs/developers/event-contracts" target="_blank" rel="noreferrer">Built on DreamDEX</a>
    </footer>
  </div>
`
