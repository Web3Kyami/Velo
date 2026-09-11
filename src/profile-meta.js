export const profileNameMessage = (walletAddress, displayName) => `Set Velo display name\nWallet: ${walletAddress.toLowerCase()}\nName: ${displayName}`

export async function getProfileMetadata(walletAddress) {
  const response = await fetch(`/api/profile-meta/${encodeURIComponent(walletAddress)}`)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Profile identity could not be loaded.')
  return body
}

export async function updateProfileDisplayName(walletAddress, displayName) {
  if (!window.ethereum) throw new Error('No compatible browser wallet was detected.')

  let accounts = await window.ethereum.request({ method: 'eth_accounts' })
  if (!accounts?.[0]) accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })

  const connected = accounts?.[0]
  if (!connected || connected.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new Error('Connect the wallet that owns this profile.')
  }

  const cleanName = String(displayName || '').trim().replace(/\s+/g, ' ')
  const message = profileNameMessage(walletAddress, cleanName)
  const signature = await window.ethereum.request({ method: 'personal_sign', params: [message, connected] })
  const response = await fetch(`/api/profile-meta/${encodeURIComponent(walletAddress)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: cleanName, signature }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Display name could not be updated.')
  return body
}
