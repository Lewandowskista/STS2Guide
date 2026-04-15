import { useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useGameStateBridge, useGameState, useConnected } from './hooks/useGameState'
import { useAdvisor } from './hooks/useAdvisor'
import { ConnectionStatus } from './components/ConnectionStatus'
import { MiniDock } from './components/MiniDock'
import { DeckPanel } from './components/panels/DeckPanel'
import { CombatPanel } from './components/panels/CombatPanel'
import { CardRewardPanel } from './components/panels/CardRewardPanel'
import { MapPanel } from './components/panels/MapPanel'
import { RelicPanel } from './components/panels/RelicPanel'
import { EventPanel } from './components/panels/EventPanel'
import { ShopPanel } from './components/panels/ShopPanel'
import { RestSitePanel } from './components/panels/RestSitePanel'
import { getActiveContext, isHoldState } from './utils/context-resolution'

function AdvisoryPanels() {
  const state = useGameState()
  // During hold states (rewards, treasure, crystal_sphere) keep the last panel visible.
  const lastContextRef = useRef<ReturnType<typeof getActiveContext>>(null)

  if (!state) return null

  const activeContext = getActiveContext(state)

  if (activeContext !== null) {
    lastContextRef.current = activeContext
  }

  // Use the last known context during hold states so panels stay visible
  const displayContext = isHoldState(state) ? lastContextRef.current : activeContext

  return (
    <AnimatePresence mode="wait">
      {displayContext === 'combat' && <CombatPanel key="combat" />}
      {displayContext === 'card_reward' && <CardRewardPanel key="card-reward" />}
      {displayContext === 'map' && <MapPanel key="map" />}
      {displayContext === 'relic_select' && <RelicPanel key="relic" />}
      {displayContext === 'event' && <EventPanel key="event" />}
      {displayContext === 'shop' && <ShopPanel key="shop" />}
      {displayContext === 'rest_site' && <RestSitePanel key="rest" />}
    </AnimatePresence>
  )
}

function AppContent() {
  // Wire IPC bridge + load codex
  useGameStateBridge()
  // Trigger advisor engine on state changes
  useAdvisor()

  const connected = useConnected()
  const state = useGameState()

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Always show connection status */}
      <ConnectionStatus />

      {/* Debug indicator — top-right, small, won't overlap game UI */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-black/60 rounded-b text-[10px] text-white/40 select-none font-mono pointer-events-none">
        {connected ? state?.state_type ?? '…' : '✗'}
      </div>

      {/* Advisor content — only when connected and in a run */}
      {connected && (
        <>
          <AdvisoryPanels />
          <MiniDock />
          <DeckPanel />
        </>
      )}
    </div>
  )
}

export default function App() {
  return <AppContent />
}
