import type { AttackPattern, AttackPatternState, MonsterMove } from '@/types/codex'

// Given an attack pattern and current move, predict the next likely move
export function predictNextMove(
  pattern: AttackPattern,
  currentMoveId: string,
  moves: MonsterMove[],
): MonsterMove | null {
  if (!pattern?.states?.length) return null

  const moveMap = new Map(moves.map(m => [m.id, m]))
  const currentState = pattern.states.find(s => s.move_id === currentMoveId)

  if (!currentState) {
    // Try to find initial state
    const initial = pattern.initial_move
      ? pattern.states.find(s => s.move_id === pattern.initial_move)
      : pattern.states[0]
    if (!initial) return null
    return initial.move_id ? (moveMap.get(initial.move_id) ?? null) : null
  }

  // Get next state
  if (currentState.next) {
    const nextState = pattern.states.find(s => s.id === currentState.next)
    if (nextState?.move_id) return moveMap.get(nextState.move_id) ?? null
  }

  // Random branch: pick the highest-weight option
  if (currentState.branches?.length) {
    const sorted = [...currentState.branches].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    const best = sorted[0]
    return best.move_id ? (moveMap.get(best.move_id) ?? null) : null
  }

  // Cycle: find the next state in order
  const idx = pattern.states.indexOf(currentState)
  if (idx >= 0 && idx + 1 < pattern.states.length) {
    const next = pattern.states[idx + 1]
    if (next.move_id) return moveMap.get(next.move_id) ?? null
  }

  // Wrap around
  if (pattern.states[0]?.move_id) {
    return moveMap.get(pattern.states[0].move_id) ?? null
  }

  return null
}

// Get a human-readable description of a move's intent
export function describeMoveIntent(move: MonsterMove): string {
  const parts: string[] = []
  if (move.damage) {
    const hits = move.damage.hit_count ?? 1
    parts.push(hits > 1 ? `${move.damage.normal}×${hits}` : `${move.damage.normal} dmg`)
  }
  if (move.block) parts.push(`${move.block} block`)
  if (move.heal) parts.push(`heal ${move.heal}`)
  if (move.powers?.length) {
    move.powers.forEach(p => {
      parts.push(`${p.power_id}(${p.amount}) → ${p.target}`)
    })
  }
  return parts.join(', ') || (move.intent ?? 'Unknown')
}
