const path = window.location.pathname.replace(/\/+$/, '') || '/'

let entry

if (path === '/') {
  entry = import('./landing.js')
} else if (path === '/app') {
  entry = import('./product.js')
} else {
  entry = import('./main.js')
}

entry.catch((error) => {
  console.error('Velo route failed to load', error)
  document.querySelector('#app').innerHTML = '<main class="route-error"><h1>Velo could not load this page.</h1><a href="/">Return home</a></main>'
})
