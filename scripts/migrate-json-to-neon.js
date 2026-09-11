import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { prepareStorage, saveCallRecord, storageMode } from '../server/storage.js'

if (storageMode !== 'neon') {
  console.error('DATABASE_URL is required to migrate local Call records to Neon.')
  process.exit(1)
}

const dataPath = resolve(process.env.VELO_DATA_PATH || 'data/calls.json')
if (!existsSync(dataPath)) {
  console.log('No local Call file found. Neon schema preparation is still complete.')
  await prepareStorage()
  process.exit(0)
}

const calls = JSON.parse(readFileSync(dataPath, 'utf8'))
await prepareStorage()
const records = Object.values(calls)
for (const record of records) await saveCallRecord(record)
console.log(`Migrated ${records.length} Call record${records.length === 1 ? '' : 's'} to Neon.`)
