import { describe, expect, it } from 'vitest'
import { getActiveContext, shouldKeepCombatAdvice } from './context-resolution'

describe('context resolution', () => {
  it('detects combat from battle payloads even when state_type is unexpected', () => {
    expect(getActiveContext({
      state_type: 'unknown',
      battle: {
        round: 1,
        turn: 'player',
        is_play_phase: true,
        enemies: [{
          entity_id: 'monster-1',
          combat_id: 1,
          name: 'Jaw Worm',
          hp: 40,
          max_hp: 40,
          block: 0,
          status: [],
          intents: [],
        }],
      },
    })).toBe('combat')
  })

  it('detects map context from map payloads even when state_type is unexpected', () => {
    expect(getActiveContext({
      state_type: 'unknown',
      map: {
        current_position: { col: 1, row: 1, type: 'Monster' },
        next_options: [{ col: 2, row: 2, type: 'Elite' }],
      },
    })).toBe('map')
  })

  it('keeps combat advice alive during mid-combat overlay states', () => {
    expect(shouldKeepCombatAdvice({
      state_type: 'overlay',
      battle: {
        round: 2,
        turn: 'player',
        is_play_phase: true,
        enemies: [{
          entity_id: 'boss-1',
          combat_id: 2,
          name: 'Boss',
          hp: 200,
          max_hp: 200,
          block: 0,
          status: [],
          intents: [],
        }],
      },
    })).toBe(true)
  })

  it('detects shop context from shop payloads', () => {
    expect(getActiveContext({
      state_type: 'unknown',
      shop: { items: [] },
    })).toBe('shop')
  })
})
