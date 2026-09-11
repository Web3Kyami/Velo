export const stateFromOnchain = (onchain) => {
  if (!onchain) return 'Receipt'
  if (onchain.status === 1) return 'Live'
  if (onchain.status === 2 || onchain.status === 3) return 'Settling'
  return 'Receipt'
}

export const resultFromOnchain = (onchain, outcomeIndex) => {
  if (!onchain) return null
  if (onchain.isVoided || onchain.status === 5) return 'Void'
  if (onchain.isResolved || onchain.status === 4) return onchain.winningOutcome === outcomeIndex ? 'Won' : 'Lost'
  return null
}

export const pickSuccessorRecord = (records, current) => records
  .filter((record) => record.id !== current.id && record.asset === current.asset && record.interval === current.interval && record.createdAt > current.createdAt)
  .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0] || null
