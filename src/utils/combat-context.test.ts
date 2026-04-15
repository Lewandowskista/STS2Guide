import { describe, expect, it } from 'vitest'
import { isCombatState, shouldShowCombatPanel } from './combat-context'

describe('combat context detection', () => {
  it('treats live battle payloads as combat even when state_type is unexpected', () => {
    expect(isCombatState({
      state_type: 'unknown',
      battle: {
        round: 1,
        turn: 'player',
        is_play_phase: true,
        enemies: [{
          entity_id: 'elite-1',
          combat_id: 1,
          name: 'Elite Test',
          hp: 30,
          max_hp: 30,
          block: 0,
          status: [],
          intents: [],
        }],
      },
    })).toBe(true)
  })

  it('keeps the combat panel visible for mid-combat overlay states', () => {
    expect(shouldShowCombatPanel({
      state_type: 'hand_select',
      battle: {
        round: 1,
        turn: 'player',
        is_play_phase: true,
        enemies: [{
          entity_id: 'boss-1',
          combat_id: 2,
          name: 'Boss Test',
          hp: 200,
          max_hp: 200,
          block: 0,
          status: [],
          intents: [],
        }],
      },
    })).toBe(true)
  })
})
