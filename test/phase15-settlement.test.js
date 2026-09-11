import test from 'node:test'
import assert from 'node:assert/strict'
import { pickSuccessorRecord, resultFromOnchain, stateFromOnchain } from '../server/settlement.js'

test('settlement fixture derives live and unsettled states without a result', () => {
  assert.equal(stateFromOnchain({ status: 1 }), 'Live')
  assert.equal(resultFromOnchain({ status: 1, isResolved: false, isVoided: false }, 0), null)
  assert.equal(stateFromOnchain({ status: 2 }), 'Settling')
  assert.equal(resultFromOnchain({ status: 2, isResolved: false, isVoided: false }, 0), null)
})

test('settlement fixture derives both resolved outcomes', () => {
  const resolvedYes = { status: 4, isResolved: true, isVoided: false, winningOutcome: 0 }
  const resolvedNo = { status: 4, isResolved: true, isVoided: false, winningOutcome: 1 }
  assert.equal(resultFromOnchain(resolvedYes, 0), 'Won')
  assert.equal(resultFromOnchain(resolvedYes, 1), 'Lost')
  assert.equal(resultFromOnchain(resolvedNo, 1), 'Won')
  assert.equal(resultFromOnchain(resolvedNo, 0), 'Lost')
})

test('settlement fixture keeps void separate from win and loss', () => {
  assert.equal(stateFromOnchain({ status: 5 }), 'Receipt')
  assert.equal(resultFromOnchain({ status: 5, isResolved: false, isVoided: true }, 0), 'Void')
})

test('successor fixture selects the next real record in the same series', () => {
  const current = { id: 'current', asset: 'BTC', interval: '5m', createdAt: '2026-09-11T10:00:00.000Z' }
  const later = { id: 'later', asset: 'BTC', interval: '5m', createdAt: '2026-09-11T11:00:00.000Z' }
  const earliest = { id: 'earliest', asset: 'BTC', interval: '5m', createdAt: '2026-09-11T10:30:00.000Z' }
  const differentAsset = { id: 'eth', asset: 'ETH', interval: '5m', createdAt: '2026-09-11T10:15:00.000Z' }
  assert.equal(pickSuccessorRecord([later, differentAsset, earliest], current).id, 'earliest')
  assert.equal(pickSuccessorRecord([differentAsset], current), null)
})
