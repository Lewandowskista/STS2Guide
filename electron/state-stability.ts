export interface SnapshotLike {
  state_type?: string
  battle?: { enemies?: unknown[] } | null
  player?: { character?: string } | null
  run?: { act?: number; floor?: number } | null
}

const DIRECT_COMBAT_STATES = new Set(['monster', 'elite', 'boss'])
const TRANSIENT_NON_COMBAT_STATES = new Set(['unknown', 'menu'])

export function hasBattleData(state: SnapshotLike | null | undefined): boolean {
  return Boolean(state?.battle && Array.isArray(state.battle.enemies) && state.battle.enemies.length > 0)
}

function isCombatSnapshot(state: SnapshotLike | null | undefined): boolean {
  if (!state) return false
  return DIRECT_COMBAT_STATES.has(state.state_type ?? '') || hasBattleData(state)
}

export function shouldSuppressTransientCombatState(previous: SnapshotLike | null | undefined, next: SnapshotLike): boolean {
  if (!previous || !isCombatSnapshot(previous)) return false
  if (hasBattleData(next)) return false
  if (!TRANSIENT_NON_COMBAT_STATES.has(next.state_type ?? '')) return false
  if (!previous.player?.character || !next.player?.character) return false
  if (previous.player.character !== next.player.character) return false
  if (previous.run?.act !== next.run?.act) return false
  if (previous.run?.floor !== next.run?.floor) return false
  return true
}
