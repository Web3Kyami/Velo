const path = window.location.pathname

if (path === '/' || path === '') {
  await import('./landing.js')
} else if (path === '/app' || path === '/app/') {
  await import('./product.js')
} else {
  await import('./main.js')
}
