import './landing.css'

const arrow = '<span class="arrow" aria-hidden="true">↗</span>'

document.body.className = 'landing-body'
document.querySelector('#app').innerHTML = `
  <header class="landing-header">
    <a class="logo" href="/" aria-label="Velo home"><span class="logo-mark">v</span><span>velo</span></a>
    <nav class="landing-nav" aria-label="Primary navigation">
      <a href="#how-it-works">How it works</a>
      <a class="button button--dark button--small" href="/app">Open Velo ${arrow}</a>
    </nav>
  </header>

  <main>
    <section class="landing-hero">
      <div class="landing-hero__copy">
        <p class="kicker"><span class="kicker-dot"></span> A public record for your market calls</p>
        <h1>Put your calls<br /><i>on the record.</i></h1>
        <p class="landing-hero__lede">Make a call. Share it while it is live. Keep the result as part of your record.</p>
        <a class="button button--dark landing-hero__cta" href="/app">Open Velo ${arrow}</a>
      </div>
      <div class="record-art" aria-label="A conceptual Velo Call record">
        <div class="record-art__glow"></div>
        <div class="record-card">
          <div class="record-card__header"><span class="record-card__stamp">VELO / CALL</span><span class="record-card__live"><span></span> LIVE</span></div>
          <div class="record-card__body"><span class="record-card__label">A view worth standing behind</span><strong>Your call</strong><div class="record-card__line"></div><span class="record-card__signature">Made by you<br />Shared in the moment</span></div>
          <div class="record-card__footer"><span>01</span><span>OPEN RECORD</span><span>↗</span></div>
        </div>
        <span class="record-art__caption">Make it visible<br />while it matters.</span>
      </div>
    </section>

    <section class="landing-loop" id="how-it-works">
      <div class="section-heading"><p class="kicker">The Velo loop</p><h2>One call.<br /><i>A lasting record.</i></h2></div>
      <div class="loop-steps">
        <article class="loop-step"><span class="loop-step__number">01</span><div><h3>Make a call</h3><p>Choose a live window and put your view behind it.</p></div></article>
        <article class="loop-step"><span class="loop-step__number">02</span><div><h3>Share it</h3><p>Let people see what you believe while the window is open.</p></div></article>
        <article class="loop-step"><span class="loop-step__number">03</span><div><h3>Build your record</h3><p>When the moment passes, the result stays with your history.</p></div></article>
      </div>
    </section>

    <section class="landing-states">
      <div class="state-intro"><p class="kicker">What a call becomes</p><h2>From a live view<br />to a <i>receipt.</i></h2><p>Every call keeps the context that made it worth sharing.</p></div>
      <div class="state-rail" aria-label="The three stages of a Velo Call">
        <div class="state-rail__track"></div>
        <div class="state-node state-node--active"><span class="state-node__dot"></span><strong>Live call</strong><p>Your view is open to the world.</p></div>
        <div class="state-node"><span class="state-node__dot"></span><strong>Settled receipt</strong><p>The result has a place in the story.</p></div>
        <div class="state-node"><span class="state-node__dot"></span><strong>Public record</strong><p>Your history is there to check.</p></div>
      </div>
    </section>

    <section class="landing-final">
      <div><p class="kicker">Conviction is more useful when it is visible.</p><h2>Make your next call<br /><i>count.</i></h2></div>
      <a class="button button--light" href="/app">Open Velo ${arrow}</a>
    </section>
  </main>

  <footer class="landing-footer"><a class="logo" href="/"><span class="logo-mark">v</span><span>velo</span></a><span>Make the call. Keep the receipt.</span></footer>
`
