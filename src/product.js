document.body.classList.add('product-mode')
await import('./main.js')
await import('./product.css')

document.title = 'Live Calls | Velo'

document.querySelectorAll('.wordmark').forEach((link) => { link.href = '/' })
const intro = document.querySelector('.section-intro')
if (intro) {
  const eyebrow = intro.querySelector('.eyebrow')
  const heading = intro.querySelector('h2')
  const body = intro.querySelector('.body-muted')
  if (eyebrow) eyebrow.textContent = 'Live desk'
  if (heading) heading.innerHTML = 'Choose the view<br><em>you will stand behind.</em>'
  if (body) body.textContent = 'Browse current DreamDEX windows, choose a side and publish a Call only after your position fills.'
}
