import { motion, AnimatePresence } from 'framer-motion'
import { useAdvisorStore } from '@/stores/advisor-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useGameState } from '@/hooks/useGameState'
import { SynergyTag } from '../shared/SynergyTag'
import { X, Target } from 'lucide-react'

export function DeckPanel() {
  const deckAnalysis = useAdvisorStore(s => s.deckAnalysis)
  const isDeckOpen = useSettingsStore(s => s.isDeckPanelOpen)
  const toggleDeck = useSettingsStore(s => s.toggleDeckPanel)
  const state = useGameState()

  if (!state?.player) return null

  return (
    <AnimatePresence>
      {isDeckOpen && deckAnalysis && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed right-1 top-1 w-72 max-h-[calc(100vh-80px)] overflow-y-auto bg-black/85 backdrop-blur rounded-xl border border-white/10"
          onMouseEnter={() => window.stsApi.setInteractive(true)}
          onMouseLeave={() => window.stsApi.setInteractive(false)}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-sm font-medium text-white/80">Deck Analysis</span>
            <button onClick={toggleDeck} className="text-white/40 hover:text-white/70">
              <X size={14} />
            </button>
          </div>

          <div className="px-3 py-2 space-y-3">
            {/* Power Level */}
            {deckAnalysis.powerLevel !== undefined && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-white/40 uppercase tracking-wide">Deck Power</div>
                  <span className={`text-xs font-bold ${
                    deckAnalysis.powerLevel >= 7 ? 'text-green-300' :
                    deckAnalysis.powerLevel >= 4 ? 'text-yellow-300' :
                    'text-red-300'
                  }`}>{deckAnalysis.powerLevel.toFixed(1)}/10</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      deckAnalysis.powerLevel >= 7 ? 'bg-green-400' :
                      deckAnalysis.powerLevel >= 4 ? 'bg-yellow-400' :
                      'bg-red-400'
                    }`}
                    style={{ width: `${(deckAnalysis.powerLevel / 10) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Archetype lock warning */}
            {deckAnalysis.archetypeLockWarning && (
              <div className="flex items-start gap-1.5 px-2 py-1.5 bg-amber-900/20 rounded border border-amber-500/40">
                <span className="text-amber-400 shrink-0 mt-0.5 text-xs">⚠</span>
                <div className="text-xs text-amber-200/90">{deckAnalysis.archetypeLockWarning}</div>
              </div>
            )}

            {/* Win condition */}
            {deckAnalysis.winCondition && (
              <div className="flex items-start gap-1.5 px-2 py-1.5 bg-blue-900/20 rounded border border-blue-500/20">
                <Target size={11} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] text-blue-400/60 uppercase tracking-wide mb-0.5">Win Condition</div>
                  <div className="text-xs text-blue-200/80">{deckAnalysis.winCondition}</div>
                </div>
              </div>
            )}

            {/* Build Targets */}
            {deckAnalysis.buildTargets && deckAnalysis.buildTargets.length > 0 && (
              <div>
                <div className="text-xs text-white/40 uppercase tracking-wide mb-1.5">Build Target</div>
                <div className="space-y-2">
                  {deckAnalysis.buildTargets.map(bt => (
                    <div key={bt.build.id} className="px-2 py-1.5 bg-purple-900/20 rounded border border-purple-500/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-purple-200">{bt.build.name}</span>
                        <span className="text-[10px] text-purple-400/60">{Math.round(bt.completion * 100)}%</span>
                      </div>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-1.5">
                        <div
                          className="h-full bg-purple-400 rounded-full transition-all"
                          style={{ width: `${bt.completion * 100}%` }}
                        />
                      </div>
                      {bt.coreMissing.length > 0 && (
                        <div>
                          <div className="text-[10px] text-white/30 mb-0.5">Missing core:</div>
                          <div className="flex flex-wrap gap-1">
                            {bt.coreMissing.map(c => (
                              <span key={c} className="text-[10px] px-1.5 py-0.5 bg-red-900/40 text-red-300 rounded">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {bt.coreMissing.length === 0 && (
                        <div className="text-[10px] text-green-400/70">All core cards owned ✓</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Archetype */}
            <div>
              <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Archetype</div>
              <div className="text-sm text-white font-medium">{deckAnalysis.archetype.label}</div>
              {deckAnalysis.archetype.secondary && (
                <div className="text-xs text-white/50">/ {deckAnalysis.archetype.secondary}</div>
              )}
              {/* Confidence bar */}
              <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all"
                  style={{ width: `${deckAnalysis.archetype.confidence * 100}%` }}
                />
              </div>
              <div className="text-xs text-white/30 mt-0.5">
                {Math.round(deckAnalysis.archetype.confidence * 100)}% confidence
              </div>
            </div>

            {/* Card composition */}
            <div>
              <div className="text-xs text-white/40 uppercase tracking-wide mb-1.5">Composition ({deckAnalysis.totalCards} cards)</div>
              <div className="space-y-1">
                {[
                  { label: 'Attacks', count: deckAnalysis.cardTypeBreakdown.attack, color: 'bg-red-500' },
                  { label: 'Skills', count: deckAnalysis.cardTypeBreakdown.skill, color: 'bg-blue-500' },
                  { label: 'Powers', count: deckAnalysis.cardTypeBreakdown.power, color: 'bg-purple-500' },
                  { label: 'Curses', count: deckAnalysis.cardTypeBreakdown.curse, color: 'bg-gray-600' },
                ].filter(t => t.count > 0).map(type => (
                  <div key={type.label} className="flex items-center gap-2">
                    <div className="w-16 text-xs text-white/60">{type.label}</div>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${type.color} rounded-full`}
                        style={{ width: `${(type.count / deckAnalysis.totalCards) * 100}%` }}
                      />
                    </div>
                    <div className="w-6 text-xs text-white/50 text-right">{type.count}</div>
                  </div>
                ))}
              </div>
              <div className="mt-1 text-xs text-white/30">Avg cost: {deckAnalysis.avgCost.toFixed(1)}</div>
            </div>

            {/* Key synergies */}
            {deckAnalysis.keySynergies.length > 0 && (
              <div>
                <div className="text-xs text-white/40 uppercase tracking-wide mb-1.5">Key Synergies</div>
                <div className="flex flex-wrap gap-1">
                  {deckAnalysis.keySynergies.map((s, i) => (
                    <SynergyTag key={i} reason={s} />
                  ))}
                </div>
              </div>
            )}

            {/* Weaknesses */}
            {deckAnalysis.weaknesses.length > 0 && (
              <div>
                <div className="text-xs text-white/40 uppercase tracking-wide mb-1.5">Weaknesses</div>
                <div className="space-y-1">
                  {deckAnalysis.weaknesses.map((w, i) => (
                    <div
                      key={i}
                      className={`text-xs px-2 py-1 rounded ${
                        w.severity === 'major' ? 'bg-red-900/30 text-red-300' : 'bg-yellow-900/20 text-yellow-300'
                      }`}
                    >
                      {w.severity === 'major' ? '⚠ ' : '• '}{w.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
