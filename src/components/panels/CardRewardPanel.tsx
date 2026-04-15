import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, ChevronDown, SkipForward, Layers, TrendingUp, AlertTriangle, Skull } from 'lucide-react'
import { useAdvisorStore } from '@/stores/advisor-store'
import { useGameState } from '@/hooks/useGameState'
import { RatingBadge } from '../shared/RatingBadge'
import { SynergyTag } from '../shared/SynergyTag'

export function CardRewardPanel() {
  const cardRatings = useAdvisorStore(s => s.cardRatings)
  const deckAnalysis = useAdvisorStore(s => s.deckAnalysis)
  const state = useGameState()
  const [expanded, setExpanded] = useState(true)

  if (!cardRatings?.length) {
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
          <Trophy size={14} />
          <span>Card Reward</span>
        </div>
        <div className="text-xs text-white/30 mt-1">Evaluating cards…</div>
      </motion.div>
    )
  }

  const canSkip = state?.card_reward?.can_skip ?? true
  const allSkip = cardRatings.every(c => c.isSkipBetter)
  const archetype = deckAnalysis?.archetype

  return (
    <motion.div
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      className="fixed left-1 top-1 w-64 max-h-[calc(100vh-80px)] overflow-y-auto bg-black/80 backdrop-blur rounded-xl border border-white/10"
      onMouseEnter={() => window.stsApi.setInteractive(true)}
      onMouseLeave={() => window.stsApi.setInteractive(false)}
    >
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2 text-white/80">
          <Trophy size={14} />
          <span className="text-sm font-medium">Card Advisor</span>
        </div>
        <ChevronDown size={14} className={`text-white/40 transition-transform ${expanded ? '' : '-rotate-90'}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {/* Build context */}
              {archetype && archetype.primary !== 'balanced' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-900/25 rounded border border-indigo-500/20 text-xs text-indigo-300">
                  <Layers size={10} />
                  <span>Scoring for: <span className="font-medium">{archetype.label}</span></span>
                  <span className="ml-auto text-indigo-400/60">{Math.round(archetype.confidence * 100)}%</span>
                </div>
              )}
              {allSkip && canSkip && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-700/40 rounded text-xs text-gray-300">
                  <SkipForward size={11} />
                  Consider skipping — no strong options for your deck
                </div>
              )}
              {cardRatings.map((evaluation, i) => {
                const card = evaluation.card
                // Use inline API data as primary source (more accurate than codex for live cards)
                const cardType = card.type ?? evaluation.codexCard?.type
                const cardRarity = card.rarity ?? evaluation.codexCard?.rarity
                const cardCostVal = card.cost
                const keywords = card.keywords ?? []

                return (
                  <div
                    key={i}
                    className={`rounded-lg p-2 ${i === 0 ? 'bg-white/10 ring-1 ring-white/20' : 'bg-white/5'}`}
                  >
                    <div className="flex items-center gap-2">
                      <RatingBadge rating={evaluation.rating} score={evaluation.score} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="text-sm text-white font-medium truncate">
                            {card.name}
                            {card.is_upgraded && <span className="text-yellow-400">+</span>}
                          </div>
                          {evaluation.isCoreCard && (
                            <span className="text-[9px] px-1 py-0.5 bg-amber-500/20 text-amber-300 rounded font-bold tracking-wide shrink-0">
                              KEY
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/40">
                          {cardType}
                          {cardRarity ? ` · ${cardRarity}` : ''}
                          {cardCostVal !== undefined ? ` · ${cardCostVal} energy` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Card description from API */}
                    {card.description && (
                      <div className="mt-1 text-xs text-white/40 line-clamp-2">{card.description}</div>
                    )}

                    {/* Keywords from API */}
                    {keywords.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {keywords.map((kw, ki) => (
                          <span key={ki} className="px-1 py-0.5 bg-white/10 rounded text-white/40 text-[10px]">
                            {kw.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Synergy reasons */}
                    {evaluation.reasons.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {evaluation.reasons.slice(0, 2).map((r, j) => (
                          <SynergyTag key={j} reason={r} />
                        ))}
                      </div>
                    )}
                    {evaluation.reasons.length > 0 && (
                      <div className="mt-1 text-xs text-white/40 line-clamp-2">
                        {evaluation.reasons[0].description}
                      </div>
                    )}

                    {/* Scaling note */}
                    {evaluation.scalingNote && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-300/80">
                        <TrendingUp size={10} />
                        {evaluation.scalingNote}
                      </div>
                    )}

                    {/* Redundancy warning */}
                    {evaluation.redundancyNote && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-orange-300/80">
                        <AlertTriangle size={10} />
                        {evaluation.redundancyNote}
                      </div>
                    )}

                    {/* Boss/Elite threat fit */}
                    {evaluation.upcomingThreatFit && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-red-300/80">
                        <Skull size={10} />
                        {evaluation.upcomingThreatFit}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
