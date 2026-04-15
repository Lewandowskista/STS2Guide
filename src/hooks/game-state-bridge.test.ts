import { describe, expect, it, vi } from 'vitest'
import type { GameState } from '@/types/game-state'
import { attachGameStateBridge } from './game-state-bridge'

function makeState(): GameState {
  return {
    state_type: 'event',
    run: { act: 1, floor: 1 },
    player: {
      character: 'The Defect',
      hp: 75,
      max_hp: 75,
      block: 0,
      energy: 3,
      max_energy: 3,
      gold: 99,
      hand: [],
      draw_pile: [],
      discard_pile: [],
      exhaust_pile: [],
      draw_pile_count: 0,
      discard_pile_count: 0,
      orbs: [],
      status: [],
      relics: [],
      potions: [],
    },
  }
}

describe('attachGameStateBridge', () => {
  it('hydrates the renderer from the current main-process snapshot before waiting for events', async () => {
    const state = makeState()
    const setState = vi.fn()
    const setConnected = vi.fn()
    const setCodexData = vi.fn()
    const setCodexLoading = vi.fn()
    const setCodexError = vi.fn()
    const cycleCombatLine = vi.fn()
    const cycleCombatBuild = vi.fn()

    const detach = attachGameStateBridge({
      api: {
        onStateUpdate: () => () => undefined,
        onConnectionChange: () => () => undefined,
        onCombatShortcut: () => () => undefined,
        getCodexData: () => Promise.resolve({}),
        getBridgeSnapshot: () => Promise.resolve({ connected: true, state }),
      },
      actions: {
        setState,
        setConnected,
        setCodexData,
        setCodexLoading,
        setCodexError,
        cycleCombatLine,
        cycleCombatBuild,
      },
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(setConnected).toHaveBeenCalledWith(true)
    expect(setState).toHaveBeenCalledWith(state)
    expect(setCodexLoading).toHaveBeenCalledWith(true)

    detach()
  })
})
