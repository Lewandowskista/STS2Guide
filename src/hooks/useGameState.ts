import { useEffect } from 'react'
import { useGameStore } from '@/stores/game-store'
import { useCodexStore } from '@/stores/codex-store'
import { useAdvisorStore } from '@/stores/advisor-store'
import type { GameState } from '@/types/game-state'
import { attachGameStateBridge, type BridgeSnapshot } from './game-state-bridge'

// Type the electron bridge
declare global {
  interface Window {
    stsApi: {
      onStateUpdate: (cb: (state: GameState) => void) => () => void
      onConnectionChange: (cb: (connected: boolean) => void) => () => void
      getCodexData: () => Promise<Record<string, unknown>>
      setInteractive: (interactive: boolean) => void
      onCombatShortcut: (cb: (action: 'cycle-line' | 'cycle-build') => void) => () => void
      getBridgeSnapshot: () => Promise<BridgeSnapshot>
    }
  }
}

export function useGameStateBridge() {
  const setGameState = useGameStore(s => s.setState)
  const setConnected = useGameStore(s => s.setConnected)
  const setCodexData = useCodexStore(s => s.setData)
  const setCodexLoading = useCodexStore(s => s.setLoading)
  const setCodexError = useCodexStore(s => s.setError)
  const cycleCombatLine = useAdvisorStore(s => s.cycleCombatLine)
  const cycleCombatBuild = useAdvisorStore(s => s.cycleCombatBuild)

  useEffect(() => {
    return attachGameStateBridge({
      api: window.stsApi,
      actions: {
        setState: setGameState,
        setConnected,
        setCodexData,
        setCodexLoading,
        setCodexError,
        cycleCombatLine,
        cycleCombatBuild,
      },
    })
  }, [cycleCombatBuild, cycleCombatLine, setGameState, setConnected, setCodexData, setCodexLoading, setCodexError])
}

export function useGameState() {
  return useGameStore(s => s.state)
}

export function useConnected() {
  return useGameStore(s => s.connected)
}
