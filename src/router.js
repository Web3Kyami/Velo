const path = window.location.pathname.replace(/\/+$/, '') || '/'

let entry

if (path === '/') {
  entry = import('./landing.js')
} else if (path === '/app') {
  entry = import('./wallet-session.js')
    .then(async ({ restoreSession, warmTradeSession }) => {
      await restoreSession()
      warmTradeSession()
      await import('./product-v4.js')
      return import('./app-guards.js')
    })
} else if (path.startsWith('/profile/')) {
  entry = import('./wallet-session.js')
    .then(async ({ restoreSession }) => {
      await restoreSession()
      return import('./profile-v4.js')
    })
} else if (path.startsWith('/call/')) {
  entry = import('./wallet-session.js')
    .then(async ({ restoreSession }) => {
      await restoreSession()
      return import('./receipt-v5.js')
    })
} else {
  entry = import('./main.js')
}

entry.catch((error) => {
  console.error('Velo route failed to load', error)
  document.querySelector('#app').innerHTML = '<main class="route-error"><h1>Velo could not load this page.</h1><a href="/">Return home</a></main>'
})
