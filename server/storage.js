import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'
import { pickSuccessorRecord } from './settlement.js'

const dataPath = resolve(process.env.VELO_DATA_PATH || 'data/calls.json')
const databaseUrl = process.env.DATABASE_URL?.trim()
if (databaseUrl && /^psql\s+['"]/.test(databaseUrl)) {
  throw new Error('DATABASE_URL must be the raw postgresql:// URL, not the full psql command.')
}
const sql = databaseUrl ? neon(databaseUrl) : null
let schemaPromise

const mapRow = (row) => ({
  id: row.id,
  marketId: row.market_id,
  transactionHash: row.transaction_hash,
  walletAddress: row.wallet_address,
  asset: row.asset,
  interval: row.interval,
  question: row.question,
  outcome: row.outcome,
  outcomeIndex: Number(row.outcome_index),
  entryProbability: Number(row.entry_probability),
  filledQuantity: String(row.filled_quantity),
  actualCost: String(row.actual_cost),
  expiry: String(row.expiry),
  fillBlockNumber: String(row.fill_block_number),
  createdAt: new Date(row.created_at).toISOString(),
  verifiedAt: new Date(row.verified_at).toISOString(),
})

const prepareNeonSchema = async () => {
  if (!sql) return
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS calls (
          id TEXT PRIMARY KEY,
          market_id TEXT NOT NULL,
          transaction_hash TEXT NOT NULL UNIQUE,
          wallet_address TEXT NOT NULL,
          asset TEXT NOT NULL,
          interval TEXT NOT NULL,
          question TEXT NOT NULL,
          outcome TEXT NOT NULL CHECK (outcome IN ('Yes', 'No')),
          outcome_index SMALLINT NOT NULL CHECK (outcome_index IN (0, 1)),
          entry_probability DOUBLE PRECISION NOT NULL,
          filled_quantity NUMERIC(36, 18) NOT NULL,
          actual_cost NUMERIC(36, 18) NOT NULL,
          expiry BIGINT NOT NULL,
          fill_block_number BIGINT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          verified_at TIMESTAMPTZ NOT NULL
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS calls_wallet_created_idx ON calls (wallet_address, created_at DESC)`
      await sql`CREATE INDEX IF NOT EXISTS calls_market_idx ON calls (market_id)`
    })().catch((error) => {
      schemaPromise = undefined
      throw error
    })
  }
  return schemaPromise
}

const readLocalCalls = () => {
  try {
    return JSON.parse(readFileSync(dataPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

const writeLocalCalls = (calls) => {
  mkdirSync(dirname(dataPath), { recursive: true })
  writeFileSync(dataPath, `${JSON.stringify(calls, null, 2)}\n`, 'utf8')
}

export const storageMode = sql ? 'neon' : 'file'

export const prepareStorage = async () => {
  await prepareNeonSchema()
  return storageMode
}

export const getCallRecord = async (id) => {
  if (!sql) return readLocalCalls()[id] || null
  await prepareNeonSchema()
  const rows = await sql`SELECT * FROM calls WHERE id = ${id} LIMIT 1`
  return rows[0] ? mapRow(rows[0]) : null
}

export const listCallsByWallet = async (walletAddress) => {
  const normalized = walletAddress.toLowerCase()
  if (!sql) return Object.values(readLocalCalls()).filter((record) => record.walletAddress?.toLowerCase() === normalized)
  await prepareNeonSchema()
  const rows = await sql`SELECT * FROM calls WHERE wallet_address = ${normalized} ORDER BY created_at DESC`
  return rows.map(mapRow)
}

export const findSuccessorRecord = async (record) => {
  if (!sql) return pickSuccessorRecord(Object.values(readLocalCalls()), record)
  await prepareNeonSchema()
  const rows = await sql`
    SELECT * FROM calls
    WHERE asset = ${record.asset}
      AND interval = ${record.interval}
      AND created_at > ${record.createdAt}
    ORDER BY created_at ASC
    LIMIT 1
  `
  return rows[0] ? mapRow(rows[0]) : null
}

export const saveCallRecord = async (record) => {
  if (!sql) {
    const calls = readLocalCalls()
    calls[record.id] = record
    writeLocalCalls(calls)
    return record
  }

  await prepareNeonSchema()
  await sql`
    INSERT INTO calls (
      id, market_id, transaction_hash, wallet_address, asset, interval, question,
      outcome, outcome_index, entry_probability, filled_quantity, actual_cost,
      expiry, fill_block_number, created_at, verified_at
    ) VALUES (
      ${record.id}, ${record.marketId}, ${record.transactionHash}, ${record.walletAddress.toLowerCase()},
      ${record.asset}, ${record.interval}, ${record.question}, ${record.outcome}, ${record.outcomeIndex},
      ${record.entryProbability}, ${record.filledQuantity}, ${record.actualCost}, ${record.expiry},
      ${record.fillBlockNumber}, ${record.createdAt}, ${record.verifiedAt}
    )
    ON CONFLICT (transaction_hash) DO NOTHING
  `
  return getCallRecord(record.id)
}
