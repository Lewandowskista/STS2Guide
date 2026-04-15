import type { GameState } from '@/types/game-state'

export interface BridgeSnapshot {
  connected: boolean
  state: GameState | null
}

export interface GameStateBridgeApi {
  onStateUpdate: (cb: (state: GameState) => void) => () => void
  onConnectionChange: (cb: (connected: boolean) => void) => () => void
  onCombatShortcut: (cb: (action: 'cycle-line' | 'cycle-build') => void) => () => void
  getCodexData: () => Promise<Record<string, unknown>>
  getBridgeSnapshot: () => Promise<BridgeSnapshot>
}

interface GameStateBridgeActions {
  setState: (state: GameState) => void
  setConnected: (connected: boolean) => void
  setCodexData: (data: Record<string, unknown>) => void
  setCodexLoading: (loading: boolean) => void
  setCodexError: (error: string) => void
  cycleCombatLine: () => void
  cycleCombatBuild: () => void
}

export function attachGameStateBridge({
  api,
  actions,
}: {
  api: GameStateBridgeApi
  actions: GameStateBridgeActions
}) {
  const unsubState = api.onStateUpdate((state) => {
    actions.setState(state)
    actions.setConnected(true)
  })

  const unsubConn = api.onConnectionChange((connected) => {
    actions.setConnected(connected)
  })

  const unsubCombatShortcut = api.onCombatShortcut((action) => {
    if (action === 'cycle-line') actions.cycleCombatLine()
    if (action === 'cycle-build') actions.cycleCombatBuild()
  })

  // Sync initial state immediately on mount so panels show without waiting for first poll
  void api.getBridgeSnapshot()
    .then(snapshot => {
      actions.setConnected(snapshot.connected)
      if (snapshot.state) actions.setState(snapshot.state)
    })
    .catch(() => {
      // Ignore — IPC may not be ready yet; live events will sync state shortly
    })

  actions.setCodexLoading(true)
  void api.getCodexData()
    .then(data => actions.setCodexData(data))
    .catch(err => actions.setCodexError(String(err)))

  return () => {
    unsubState()
    unsubConn()
    unsubCombatShortcut()
  }
}
