import './profile-name.css'
import { getProfileMetadata, updateProfileDisplayName } from './profile-meta.js'

const address = window.location.pathname.match(/^\/profile\/(0x[a-f0-9]{40})$/i)?.[1]
if (!address) throw new Error('Profile address is missing.')

const shortAddress = (value) => `${value.slice(0, 6)}...${value.slice(-4)}`
let metadata = await getProfileMetadata(address).catch(() => ({ walletAddress: address, displayName: null }))

const waitForIdentity = () => new Promise((resolve) => {
  const existing = document.querySelector('.identity-copy-v3')
  if (existing) return resolve(existing)
  const observer = new MutationObserver(() => {
    const node = document.querySelector('.identity-copy-v3')
    if (!node) return
    observer.disconnect()
    resolve(node)
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
})

const canEdit = async () => {
  if (!window.ethereum) return false
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' })
    return accounts?.[0]?.toLowerCase() === address.toLowerCase()
  } catch {
    return false
  }
}

const renderIdentity = async () => {
  const identity = await waitForIdentity()
  const headingRow = identity.querySelector(':scope > div')
  const role = identity.querySelector(':scope > span')
  const fullAddress = identity.querySelector(':scope > small')
  const owner = await canEdit()

  headingRow.innerHTML = `<span class="profile-display-name">${metadata.displayName || shortAddress(address)}</span>${owner ? '<button class="profile-edit-name" type="button">Edit name</button>' : ''}`
  if (role) role.textContent = metadata.displayName ? 'Velo profile' : 'Wallet profile'
  if (fullAddress) {
    fullAddress.className = 'profile-owner-address'
    fullAddress.textContent = address
  }
  document.title = `${metadata.displayName || shortAddress(address)} | Velo`

  headingRow.querySelector('.profile-edit-name')?.addEventListener('click', () => openEditor(identity))
}

const openEditor = (identity) => {
  identity.querySelector('.profile-name-editor')?.remove()
  const editor = document.createElement('form')
  editor.className = 'profile-name-editor'
  editor.innerHTML = `<input name="displayName" maxlength="24" autocomplete="off" placeholder="Your display name" value="${(metadata.displayName || '').replace(/"/g, '&quot;')}"><button class="profile-name-save" type="submit">Save</button><button class="profile-name-cancel" type="button">Cancel</button>`
  identity.append(editor)
  editor.querySelector('input').focus()
  editor.querySelector('.profile-name-cancel').addEventListener('click', () => editor.remove())
  editor.addEventListener('submit', async (event) => {
    event.preventDefault()
    const save = editor.querySelector('.profile-name-save')
    const displayName = new FormData(editor).get('displayName')
    save.disabled = true
    save.textContent = 'Sign in wallet'
    try {
      metadata = await updateProfileDisplayName(address, displayName)
      editor.remove()
      await renderIdentity()
      const toast = document.querySelector('.profile-toast')
      if (toast) {
        toast.innerHTML = '<strong>Name updated</strong><span>Your profile now uses the new display name.</span>'
        toast.classList.add('is-visible')
        setTimeout(() => toast.classList.remove('is-visible'), 4200)
      }
    } catch (error) {
      save.disabled = false
      save.textContent = 'Save'
      const toast = document.querySelector('.profile-toast')
      if (toast) {
        toast.innerHTML = `<strong>Name not updated</strong><span>${error instanceof Error ? error.message : 'Try again.'}</span>`
        toast.classList.add('is-visible')
        setTimeout(() => toast.classList.remove('is-visible'), 4800)
      }
    }
  })
}

renderIdentity()
