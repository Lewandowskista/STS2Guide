import { create } from 'zustand'
import type { GameState } from '@/types/game-state'

interface GameStore {
  state: GameState | null
  connected: boolean
  lastPollTime: number
  error: string | null
  setState: (state: GameState) => void
  setConnected: (connected: boolean) => void
  setError: (error: string | null) => void
}

export const useGameStore = create<GameStore>((set) => ({
  state: null,
  connected: false,
  lastPollTime: 0,
  error: null,
  setState: (state) => set({ state, lastPollTime: Date.now() }),
  setConnected: (connected) => set({ connected }),
  setError: (error) => set({ error }),
}))
