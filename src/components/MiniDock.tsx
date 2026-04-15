import { useGameState } from '@/hooks/useGameState'
import { useAdvisorStore } from '@/stores/advisor-store'
import { useSettingsStore } from '@/stores/settings-store'
import { Heart, Coins, Layers, BookOpen, Zap, Skull, Shield, Sword, Star, FlaskConical } from 'lucide-react'
import { isBossImminent, estimateBossFloor } from '@/engine/boss-advisor'
import type { EncounterType } from '@/types/game-state'

const ORB_COLORS: Record<string, string> = {
  LIGHTNING_ORB: 'bg-yellow-400',
  FROST_ORB:     'bg-cyan-400',
  DARK_ORB:      'bg-purple-500',
  PLASMA_ORB:    'bg-pink-400',
}

export function MiniDock() {
  const state = useGameState()
  const deckAnalysis = useAdvisorStore(s => s.deckAnalysis)
  const toggleDeck = useSettingsStore(s => s.toggleDeckPanel)
  const isDeckOpen = useSettingsStore(s => s.isDeckPanelOpen)

  if (!state?.player) return null

  const { player, run } = state
  const hpPct = player.hp / player.max_hp
  const orbs = player.orbs ?? []
  const emptySlots = player.orb_empty_slots ?? 0
  const totalSlots = player.orb_slots ?? 0
  const showOrbs = totalSlots > 0

  // Combat encounter type indicator
  const inCombat = ['monster', 'elite', 'boss'].includes(state.state_type)
  const encounterType: EncounterType | null = inCombat ? (state.state_type as EncounterType) : null

  // Boss proximity indicator (outside combat)
  const act = run?.act ?? 1
  const floor = run?.floor ?? 1
  const bossFloor = estimateBossFloor(act)
  const bossClose = !inCombat && isBossImminent(floor, bossFloor, 3)
  const bossDistance = bossFloor - floor

  // Deck power level dot
  const powerLevel = deckAnalysis?.powerLevel
  const powerColor = powerLevel === undefined ? '' :
    powerLevel >= 7 ? 'bg-green-400' :
    powerLevel >= 4 ? 'bg-yellow-400' :
    'bg-red-400'

  return (
    <div
      className="fixed bottom-1 right-1 flex items-center gap-2 px-3 py-1.5 bg-black/75 backdrop-blur rounded-xl border border-white/10 text-white text-xs"
      onMouseEnter={() => window.stsApi.setInteractive(true)}
      onMouseLeave={() => window.stsApi.setInteractive(false)}
    >
      {/* HP */}
      <div className="flex items-center gap-1">
        <Heart size={13} className={hpPct < 0.3 ? 'text-red-400' : hpPct < 0.6 ? 'text-yellow-400' : 'text-green-400'} />
        <span className={hpPct < 0.3 ? 'text-red-300' : ''}>
          {player.hp}/{player.max_hp}
        </span>
      </div>

      <div className="w-px h-4 bg-white/10" />

      {/* Gold */}
      <div className="flex items-center gap-1 text-yellow-300">
        <Coins size={13} />
        <span>{player.gold}g</span>
      </div>

      {/* Energy — only during combat when energy is present */}
      {player.energy !== undefined && (
        <>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1 text-blue-300">
            <Zap size={13} />
            <span>{player.energy}/{player.max_energy}</span>
          </div>
        </>
      )}

      <div className="w-px h-4 bg-white/10" />

      {/* Floor */}
      {run && (
        <div className="text-white/60 text-xs">
          A{run.act} F{run.floor}
        </div>
      )}

      <div className="w-px h-4 bg-white/10" />

      {/* Deck button */}
      <button
        className={`flex items-center gap-1 hover:text-white transition-colors ${isDeckOpen ? 'text-blue-300' : 'text-white/70'}`}
        onClick={toggleDeck}
        title="Toggle Deck Analysis"
      >
        <Layers size={13} />
        <span className="text-xs">{(player.draw_pile_count ?? 0) + (player.hand?.length ?? 0) + (player.discard_pile_count ?? 0)}</span>
      </button>

      {/* Potions — show when player holds any */}
      {(player.potions?.length ?? 0) > 0 && (
        <>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-0.5" title="Held potions">
            <FlaskConical size={12} className="text-purple-300 shrink-0" />
            {player.potions!.map((p, i) => (
              <span
                key={i}
                className="text-[9px] px-1 py-0.5 rounded bg-purple-900/40 text-purple-200 max-w-[48px] truncate"
                title={p.name}
              >
                {p.name.replace(/ Potion$/, '')}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Stars — Regent/Watcher only */}
      {(player.stars ?? 0) > 0 && (
        <>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1 text-yellow-300" title="Stars">
            <Star size={12} />
            <span>{player.stars}</span>
          </div>
        </>
      )}

      {/* Orbs — Defect only */}
      {showOrbs && (
        <>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-0.5" title={`${orbs.length}/${totalSlots} orb slots`}>
            {orbs.map((orb, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${ORB_COLORS[orb.id] ?? 'bg-white/50'}`}
                title={`${orb.name} (passive: ${orb.passive_val}, evoke: ${orb.evoke_val})`}
              />
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} className="w-3 h-3 rounded-full border border-white/20" />
            ))}
          </div>
        </>
      )}

      {/* Encounter type badge — during combat */}
      {encounterType && (
        <>
          <div className="w-px h-4 bg-white/10" />
          {encounterType === 'boss' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-300 flex items-center gap-0.5">
              <Skull size={10} /> Boss
            </span>
          )}
          {encounterType === 'elite' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-300 flex items-center gap-0.5">
              <Zap size={10} /> Elite
            </span>
          )}
          {encounterType === 'monster' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 flex items-center gap-0.5">
              <Sword size={10} /> Monster
            </span>
          )}
        </>
      )}

      {/* Boss in N indicator — when approaching boss outside of combat */}
      {bossClose && !inCombat && (
        <>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 flex items-center gap-0.5 animate-pulse">
            <Skull size={10} /> Boss in {Math.max(0, bossDistance)}
          </span>
        </>
      )}

      {/* Archetype label + power dot */}
      {deckAnalysis && (
        <>
          <div className="w-px h-4 bg-white/10" />
          <div className="text-xs text-white/50 flex items-center gap-1">
            {powerLevel !== undefined && (
              <div className={`w-2 h-2 rounded-full ${powerColor}`} title={`Deck power: ${powerLevel}/10`} />
            )}
            <BookOpen size={11} />
            {deckAnalysis.archetype.label}
          </div>
        </>
      )}
    </div>
  )
}
