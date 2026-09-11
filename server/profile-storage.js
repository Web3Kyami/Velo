import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'

const dataPath = resolve(process.env.VELO_PROFILE_DATA_PATH || 'data/profiles.json')
const databaseUrl = process.env.DATABASE_URL?.trim()
if (databaseUrl && /^psql\s+['"]/.test(databaseUrl)) {
  throw new Error('DATABASE_URL must be the raw postgresql:// URL, not the full psql command.')
}
const sql = databaseUrl ? neon(databaseUrl) : null
let schemaPromise

const prepareSchema = async () => {
  if (!sql) return
  if (!schemaPromise) {
    schemaPromise = sql`
      CREATE TABLE IF NOT EXISTS profiles (
        wallet_address TEXT PRIMARY KEY,
        display_name TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `.catch((error) => {
      schemaPromise = undefined
      throw error
    })
  }
  return schemaPromise
}

const readLocal = () => {
  try {
    return JSON.parse(readFileSync(dataPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

const writeLocal = (profiles) => {
  mkdirSync(dirname(dataPath), { recursive: true })
  writeFileSync(dataPath, `${JSON.stringify(profiles, null, 2)}\n`, 'utf8')
}

export const getProfileMetadata = async (walletAddress) => {
  const normalized = walletAddress.toLowerCase()
  if (!sql) return readLocal()[normalized] || { walletAddress: normalized, displayName: null }
  await prepareSchema()
  const rows = await sql`SELECT wallet_address, display_name, updated_at FROM profiles WHERE wallet_address = ${normalized} LIMIT 1`
  if (!rows[0]) return { walletAddress: normalized, displayName: null }
  return {
    walletAddress: rows[0].wallet_address,
    displayName: rows[0].display_name || null,
    updatedAt: rows[0].updated_at ? new Date(rows[0].updated_at).toISOString() : null,
  }
}

export const saveProfileMetadata = async (walletAddress, displayName) => {
  const normalized = walletAddress.toLowerCase()
  const record = { walletAddress: normalized, displayName, updatedAt: new Date().toISOString() }
  if (!sql) {
    const profiles = readLocal()
    profiles[normalized] = record
    writeLocal(profiles)
    return record
  }
  await prepareSchema()
  const rows = await sql`
    INSERT INTO profiles (wallet_address, display_name, updated_at)
    VALUES (${normalized}, ${displayName}, NOW())
    ON CONFLICT (wallet_address)
    DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = NOW()
    RETURNING wallet_address, display_name, updated_at
  `
  return {
    walletAddress: rows[0].wallet_address,
    displayName: rows[0].display_name || null,
    updatedAt: new Date(rows[0].updated_at).toISOString(),
  }
}
