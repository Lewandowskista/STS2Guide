import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sword, ChevronDown, Shield, Skull, Zap, AlertTriangle, Info } from 'lucide-react'
import { useAdvisorStore } from '@/stores/advisor-store'
import { useGameState } from '@/hooks/useGameState'
import { LethalWarning } from '../shared/LethalWarning'
import { CardMini } from '../shared/CardMini'
import type { EncounterType } from '@/types/game-state'

const ENCOUNTER_CONFIG: Record<EncounterType, { label: string; color: string; icon: typeof Sword }> = {
  monster: { label: 'Monster',  color: 'text-white/60 bg-white/10',    icon: Sword },
  elite:   { label: 'Elite',    color: 'text-yellow-300 bg-yellow-900/30', icon: Zap },
  boss:    { label: 'Boss',     color: 'text-red-300 bg-red-900/40',    icon: Skull },
}

const ORB_COLORS: Record<string, string> = {
  LIGHTNING_ORB: 'bg-yellow-400 text-yellow-900',
  FROST_ORB:     'bg-cyan-400 text-cyan-900',
  DARK_ORB:      'bg-purple-500 text-white',
  PLASMA_ORB:    'bg-pink-400 text-pink-900',
}

const ORB_ABBREV: Record<string, string> = {
  LIGHTNING_ORB: 'L',
  FROST_ORB:     'F',
  DARK_ORB:      'D',
  PLASMA_ORB:    'P',
}

export function CombatPanel() {
  const advice = useAdvisorStore(s => s.combatAdvice)
  const state = useGameState()
  const [expanded, setExpanded] = useState(true)
  const [intelExpanded, setIntelExpanded] = useState(false)

  if (!state?.player) return null

  const player = state.player
  const battle = state.battle
  const orbs = player.orbs ?? []
  const showOrbs = (player.orb_slots ?? 0) > 0
  const isPlayPhase = battle?.is_play_phase ?? true

  if (!advice) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -40 }}
        className="fixed left-1 top-1 w-64 bg-black/80 backdrop-blur rounded-xl border border-white/10 p-3"
        onMouseEnter={() => window.stsApi.setInteractive(true)}
        onMouseLeave={() => window.stsApi.setInteractive(false)}
      >
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <Sword size={14} />
          <span>Combat Advisor</span>
        </div>
        <div className="text-xs text-white/30 mt-1">Analyzing enemies…</div>
      </motion.div>
    )
  }

  const {
    currentTurn,
    isLethal,
    suggestedPlay,
    summary,
    nextTurnPreview,
    potionSuggestion,
    selectedLineIndex,
    candidateLines,
    selectedBuildLensLabel,
    autoBuildLensLabel,
    selectedBuildLensId,
    encounterType,
    bossContext,
    eliteContext,
    availableEnergy,
    maxEnergy,
    activeEffectNotes,
    priorityTarget,
    enemyThreatLevel,
    availableBuildLenses,
  } = advice
  const lineCount = Math.max(1, candidateLines.length)
  const buildLabel = selectedBuildLensId === 'auto'
    ? `Auto (${autoBuildLensLabel})`
    : selectedBuildLensLabel
  const threatColors: Record<string, string> = {
    low: 'text-green-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    lethal: 'text-red-400 animate-pulse',
  }
  const activeLine = candidateLines[selectedLineIndex] ?? candidateLines[0]

  const encConfig = ENCOUNTER_CONFIG[encounterType ?? 'monster']
  const EncIcon = encConfig.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      className="fixed left-1 top-1 w-64 max-h-[calc(100vh-80px)] overflow-y-auto bg-black/80 backdrop-blur rounded-xl border border-white/10"
      onMouseEnter={() => window.stsApi.setInteractive(true)}
      onMouseLeave={() => window.stsApi.setInteractive(false)}
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2 text-white/80">
          <Sword size={14} />
          <span className="text-sm font-medium">Combat Advisor</span>
          {encounterType && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${encConfig.color}`}>
              <EncIcon size={10} />
              {encConfig.label}
            </span>
          )}
          {!isPlayPhase && (
            <span className="text-[10px] text-white/30 bg-white/10 px-1.5 py-0.5 rounded">enemy turn</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLethal && !expanded && (
            <span className="text-xs text-red-400 font-bold animate-pulse">LETHAL</span>
          )}
          <ChevronDown size={14} className={`text-white/40 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
              {/* Lethal warning */}
              {isLethal && (
                <LethalWarning damage={currentTurn.totalDamage} hp={player.hp} />
              )}

              {/* Boss Intel */}
              {bossContext && (
                <div className="rounded-lg border border-red-500/30 bg-red-900/20 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-red-900/20 transition-colors"
                    onClick={() => setIntelExpanded(e => !e)}
                  >
                    <div className="flex items-center gap-1.5 text-red-300">
                      <Skull size={12} />
                      <span className="text-xs font-medium">Boss Intel</span>
                      <span className={`text-[10px] px-1 rounded ${
                        bossContext.deckReadiness >= 7 ? 'bg-green-900/40 text-green-300' :
                        bossContext.deckReadiness >= 4 ? 'bg-yellow-900/40 text-yellow-300' :
                        'bg-red-900/40 text-red-300'
                      }`}>
                        Readiness {bossContext.deckReadiness}/10
                      </span>
                    </div>
                    <ChevronDown size={12} className={`text-red-400/60 transition-transform ${intelExpanded ? '' : '-rotate-90'}`} />
                  </button>
                  <AnimatePresence>
                    {intelExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-2 pb-2 space-y-1.5"
                      >
                        <p className="text-[11px] text-red-200/80">{bossContext.counterAdvice}</p>
                        {bossContext.threatMoves.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] text-red-400/60 uppercase tracking-wide">Watch for</div>
                            {bossContext.threatMoves.slice(0, 3).map((m, i) => (
                              <div key={i} className="text-[10px] text-red-200/70">
                                <span className="text-red-300 font-medium">{m.name}</span>
                                {m.turnEstimate && <span className="text-red-400/50"> ~T{m.turnEstimate}</span>}
                                <span className="text-red-200/50"> — {m.description}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {bossContext.missingPieces.length > 0 && (
                          <div className="space-y-0.5">
                            <div className="text-[10px] text-orange-400/60 uppercase tracking-wide">Missing</div>
                            {bossContext.missingPieces.map((p, i) => (
                              <div key={i} className="text-[10px] text-orange-200/70 flex gap-1">
                                <AlertTriangle size={10} className="text-orange-400 shrink-0 mt-0.5" />
                                {p}
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Elite Intel */}
              {eliteContext && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-900/20 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-yellow-900/20 transition-colors"
                    onClick={() => setIntelExpanded(e => !e)}
                  >
                    <div className="flex items-center gap-1.5 text-yellow-300">
                      <Zap size={12} />
                      <span className="text-xs font-medium">Elite Intel</span>
                      <span className={`text-[10px] px-1 rounded ${
                        eliteContext.rewardQuality === 'high' ? 'bg-green-900/40 text-green-300' :
                        eliteContext.rewardQuality === 'medium' ? 'bg-yellow-900/40 text-yellow-300' :
                        'bg-white/10 text-white/40'
                      }`}>
                        {eliteContext.rewardQuality} reward
                      </span>
                    </div>
                    <ChevronDown size={12} className={`text-yellow-400/60 transition-transform ${intelExpanded ? '' : '-rotate-90'}`} />
                  </button>
                  <AnimatePresence>
                    {intelExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-2 pb-2 space-y-1.5"
                      >
                        <p className="text-[11px] text-yellow-200/80">{eliteContext.recommendedStrategy}</p>
                        {eliteContext.dangerAbilities.length > 0 && (
                          <div className="space-y-0.5">
                            <div className="text-[10px] text-yellow-400/60 uppercase tracking-wide">Danger</div>
                            {eliteContext.dangerAbilities.map((a, i) => (
                              <div key={i} className="text-[10px] text-yellow-200/70 flex gap-1">
                                <AlertTriangle size={10} className="text-yellow-400 shrink-0 mt-0.5" />
                                {a}
                              </div>
                            ))}
                          </div>
                        )}
                        {eliteContext.avoidCards.length > 0 && (
                          <div className="text-[10px] text-red-300/80">
                            Avoid: <span className="font-medium">{eliteContext.avoidCards.join(', ')} cards</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Active effect notes (buffs, debuffs, conditional effects) */}
              {activeEffectNotes && activeEffectNotes.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-900/15 p-2 space-y-1">
                  <div className="flex items-center gap-1 text-[10px] text-amber-400/80 uppercase tracking-wide">
                    <Info size={10} />
                    <span>Active Effects</span>
                  </div>
                  {activeEffectNotes.map((note, i) => (
                    <div key={i} className="text-[10px] text-amber-200/80 leading-tight">{note}</div>
                  ))}
                </div>
              )}

              {/* Priority target in multi-enemy fights */}
              {priorityTarget && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-900/20 rounded border border-orange-500/30 text-xs text-orange-300">
                  <Sword size={10} />
                  <span>Focus: <span className="font-medium">{priorityTarget}</span></span>
                </div>
              )}

              {/* Potion suggestion */}
              {potionSuggestion && (
                <div className="px-2 py-1.5 bg-purple-600/30 rounded border border-purple-500/30 text-xs text-purple-200">
                  {potionSuggestion}
                </div>
              )}

              {/* Summary */}
              <div className={`text-xs px-2 py-1.5 rounded ${
                isLethal ? 'bg-red-900/40 text-red-200' :
                currentTurn.totalDamage > 10 ? 'bg-orange-900/30 text-orange-200' :
                'bg-green-900/30 text-green-200'
              }`}>
                {summary}
              </div>

              {/* Orbs — Defect only */}
              {showOrbs && (
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Orbs</div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {orbs.map((orb, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${ORB_COLORS[orb.id] ?? 'bg-white/20 text-white'}`}
                        title={`${orb.name}: passive ${orb.passive_val} dmg, evoke ${orb.evoke_val} dmg`}
                      >
                        {ORB_ABBREV[orb.id] ?? orb.name[0]}
                      </div>
                    ))}
                    {Array.from({ length: player.orb_empty_slots ?? 0 }).map((_, i) => (
                      <div key={`e${i}`} className="w-6 h-6 rounded-full border border-white/20" />
                    ))}
                    <span className="text-xs text-white/40 ml-1">
                      {orbs.length > 0 && `+${orbs.reduce((s, o) => s + o.passive_val, 0)} passive/turn`}
                    </span>
                  </div>
                </div>
              )}

              {/* Enemy breakdown */}
              {currentTurn.sources.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-white/40 uppercase tracking-wide">Incoming this turn</div>
                  {currentTurn.sources.map((src, i) => {
                    const enemy = battle?.enemies[i]
                    const buffs = enemy?.status.filter(s => s.type === 'Buff') ?? []
                    const debuffs = enemy?.status.filter(s => s.type === 'Debuff') ?? []
                    return (
                      <div key={i} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-white/70">{src.enemyName}</span>
                          <span className={src.damage > 0 ? 'text-red-300 font-mono' : 'text-white/40'}>
                            {src.damage > 0 ? `${src.damage} dmg` : src.moveType}
                          </span>
                        </div>
                        {/* Enemy status effects */}
                        {(buffs.length > 0 || debuffs.length > 0) && (
                          <div className="flex flex-wrap gap-1 pl-1">
                            {buffs.map((b, j) => (
                              <span key={j} className="text-[10px] px-1 py-0.5 rounded bg-green-900/30 text-green-300"
                                title={b.description}>
                                {b.name} {b.amount > 1 ? b.amount : ''}
                              </span>
                            ))}
                            {debuffs.map((d, j) => (
                              <span key={j} className="text-[10px] px-1 py-0.5 rounded bg-red-900/30 text-red-300"
                                title={d.description}>
                                {d.name} {d.amount > 1 ? d.amount : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {player.block > 0 && (
                    <div className="flex justify-between text-xs text-cyan-300/70">
                      <span>Your block</span>
                      <span>-{player.block}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Next turn preview */}
              {nextTurnPreview && nextTurnPreview.totalDamage > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-white/40 uppercase tracking-wide">Next turn (estimate)</div>
                  <div className="text-xs text-white/60">~{nextTurnPreview.totalDamage} dmg incoming</div>
                </div>
              )}

              {/* Play suggestions — only during player turn */}
              {isPlayPhase && activeLine && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] text-white/40 uppercase tracking-wide">Suggested play</div>
                    <div className="flex items-center gap-1 shrink-0">
                      <kbd className="px-1 py-0.5 rounded bg-white/10 border border-white/20 text-[9px] text-white/50 font-mono leading-none">F6</kbd>
                      <span className="text-[9px] text-white/25">line</span>
                      <kbd className="px-1 py-0.5 rounded bg-white/10 border border-white/20 text-[9px] text-white/50 font-mono leading-none">F7</kbd>
                      <span className="text-[9px] text-white/25">build</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-white/30">
                    <span>Line {selectedLineIndex + 1}/{lineCount} · {buildLabel}</span>
                    {availableBuildLenses && availableBuildLenses.length > 1 && (
                      <span className="text-white/20">{availableBuildLenses.length} modes</span>
                    )}
                  </div>
                  {/* Line outcome stats */}
                  {activeLine && (
                    <div className="flex items-center gap-2 text-[10px]">
                      {activeLine.estimatedBlock > 0 && (
                        <span className="text-cyan-400/70 flex items-center gap-0.5">
                          <Shield size={9} />{activeLine.estimatedBlock} block
                        </span>
                      )}
                      {activeLine.survivesIncoming ? (
                        <span className="text-green-400/70">survives</span>
                      ) : (
                        <span className="text-red-400/70">at risk</span>
                      )}
                      {enemyThreatLevel && enemyThreatLevel !== 'low' && (
                        <span className={`ml-auto capitalize ${threatColors[enemyThreatLevel] ?? 'text-white/40'}`}>
                          {enemyThreatLevel} threat
                        </span>
                      )}
                    </div>
                  )}
                  {/* Energy pips */}
                  {maxEnergy > 0 && (
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: maxEnergy }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2.5 h-2.5 rounded-full border ${
                            i < availableEnergy
                              ? 'bg-yellow-400 border-yellow-400'
                              : 'bg-transparent border-white/20'
                          }`}
                        />
                      ))}
                      <span className="text-[10px] text-white/35">{availableEnergy}/{maxEnergy} energy</span>
                    </div>
                  )}
                  {activeLine.steps.slice(0, 4).map((step, i) => (
                    step.type === 'card' && step.card ? (
                      <div key={`${step.type}-${i}`}>
                        <CardMini
                          card={step.card}
                          reason={step.reason}
                          isTop={i === 0}
                        />
                        {step.targetEnemyName && (
                          <div className="ml-2 mt-0.5 text-[10px] text-orange-300/70 flex items-center gap-1">
                            <Sword size={8} />
                            target: <span className="font-medium">{step.targetEnemyName}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        key={`${step.type}-${i}`}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${i === 0 ? 'bg-white/10 ring-1 ring-white/20' : 'bg-white/5'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium truncate">{step.label}</div>
                          <div className="text-xs text-white/50 truncate">{step.reason}</div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
      )}
    </motion.div>
  )
}
