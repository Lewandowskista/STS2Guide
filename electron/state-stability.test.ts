import { describe, expect, it } from 'vitest'
import { shouldSuppressTransientCombatState } from './state-stability'

describe('state stability', () => {
  it('suppresses transient unknown snapshots that drop battle data mid-combat', () => {
    const previous = {
      state_type: 'elite',
      run: { act: 1, floor: 8 },
      player: { character: 'The Defect' },
      battle: { enemies: [{ combat_id: 1 }] },
    }

    const next = {
      state_type: 'unknown',
      run: { act: 1, floor: 8 },
      player: { character: 'The Defect' },
    }

    expect(shouldSuppressTransientCombatState(previous, next)).toBe(true)
  })

  it('does not suppress legitimate non-combat transitions', () => {
    const previous = {
      state_type: 'boss',
      run: { act: 1, floor: 16 },
      player: { character: 'The Defect' },
      battle: { enemies: [{ combat_id: 1 }] },
    }

    const next = {
      state_type: 'rewards',
      run: { act: 1, floor: 16 },
      player: { character: 'The Defect' },
    }

    expect(shouldSuppressTransientCombatState(previous, next)).toBe(false)
  })
})
