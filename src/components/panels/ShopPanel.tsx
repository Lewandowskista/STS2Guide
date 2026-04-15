import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, ChevronDown, Layers, Skull, AlertTriangle, Scissors, Coins } from 'lucide-react'
import { useAdvisorStore } from '@/stores/advisor-store'
import { useGameState } from '@/hooks/useGameState'
import { RatingBadge } from '../shared/RatingBadge'
import { SynergyTag } from '../shared/SynergyTag'

export function ShopPanel() {
  const shopEvaluations = useAdvisorStore(s => s.shopEvaluations)
  const deckAnalysis = useAdvisorStore(s => s.deckAnalysis)
  const state = useGameState()
  const [expanded, setExpanded] = useState(true)

  if (!state?.player) return null

  if (!shopEvaluations?.length) {
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
          <ShoppingBag size={14} />
          <span>Shop Advisor</span>
        </div>
        <div className="text-xs text-white/30 mt-1">Loading shop items…</div>
      </motion.div>
    )
  }

  const gold = state.player.gold
  const worthBuying = shopEvaluations.filter(e => e.worthBuying)
  const archetype = deckAnalysis?.archetype
  const isFakeMerchant = state.state_type === 'fake_merchant'
  // Check if any item has pre-boss urgency (all items share the same flag when boss is near)
  const preBossUrgency = shopEvaluations.some(e => e.preBossUrgency)
  // Find removal target from the removal item evaluation
  const removeEval = shopEvaluations.find(e => e.type === 'remove')
  const removalTarget = removeEval?.removalTarget
  // Gold floor — minimum to hold for next shop (take max across all items)
  const goldFloor = shopEvaluations.reduce((max, e) => Math.max(max, e.goldFloor ?? 0), 0)

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
          <ShoppingBag size={14} />
          <span className="text-sm font-medium">{isFakeMerchant ? 'Fake Merchant' : 'Shop Advisor'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-yellow-300">{gold}g</span>
          <ChevronDown size={14} className={`text-white/40 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </div>
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
              {/* Fake merchant warning */}
              {isFakeMerchant && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-red-900/25 rounded border border-red-500/30 text-xs text-red-300">
                  <AlertTriangle size={10} /> Cursed shop — prices inflated, scores adjusted
                </div>
              )}
              {/* Pre-boss urgency banner */}
              {preBossUrgency && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-red-900/25 rounded border border-red-500/30 text-xs text-red-300">
                  <Skull size={10} /> Boss incoming — stock up on potions and key cards
                </div>
              )}
              {/* Build context */}
              {archetype && archetype.primary !== 'balanced' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-900/25 rounded border border-indigo-500/20 text-xs text-indigo-300">
                  <Layers size={10} />
                  <span>Build: <span className="font-medium">{archetype.label}</span></span>
                </div>
              )}
              {/* Gold floor guidance */}
              {goldFloor > 0 && gold >= goldFloor && !preBossUrgency && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-900/20 rounded border border-yellow-500/20 text-xs text-yellow-300/80">
                  <Coins size={10} />
                  <span>Hold ≥{goldFloor}g for next shop</span>
                </div>
              )}
              {goldFloor > 0 && gold < goldFloor && !preBossUrgency && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-900/20 rounded border border-yellow-500/20 text-xs text-yellow-400">
                  <Coins size={10} />
                  <span>Low gold — save {goldFloor}g for next shop opportunities</span>
                </div>
              )}
              {shopEvaluations.length === 0 && (
                <div className="text-xs text-white/40 text-center py-2">
                  Loading shop items…
                </div>
              )}
              {worthBuying.length === 0 && shopEvaluations.length > 0 && (
                <div className="text-xs text-amber-400/70 text-center py-1 bg-amber-900/20 rounded">
                  Nothing highly recommended — see ratings below
                </div>
              )}
              {shopEvaluations.map((item, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-2 ${
                    item.worthBuying
                      ? 'bg-white/10 ring-1 ring-emerald-500/40'
                      : gold >= item.price
                        ? 'bg-white/5'
                        : 'bg-white/5 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <RatingBadge rating={item.rating} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="text-sm text-white font-medium truncate">
                          {item.name || <span className="text-white/50 italic capitalize">{item.type}</span>}
                        </div>
                        {item.isCoreCard && (
                          <span className="text-[9px] px-1 py-0.5 bg-amber-500/20 text-amber-300 rounded font-bold tracking-wide shrink-0">
                            KEY
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/40 capitalize">{item.type}</div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <div className={`text-xs font-mono shrink-0 ${gold >= item.price ? 'text-yellow-300' : 'text-red-400'}`}>
                        {item.price}g
                      </div>
                      {item.worthBuying && (
                        <span className="text-[9px] text-emerald-400 font-semibold uppercase tracking-wide">Buy</span>
                      )}
                    </div>
                  </div>
                  {item.reasons.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.reasons.slice(0, 2).map((r, ri) => (
                        <SynergyTag key={ri} reason={r} />
                      ))}
                    </div>
                  )}
                  {/* Removal target suggestion */}
                  {item.type === 'remove' && removalTarget && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-orange-300">
                      <Scissors size={10} />
                      Remove: <span className="font-medium">{removalTarget}</span>
                    </div>
                  )}
                  {/* Potion slots full warning */}
                  {item.type === 'potion' && item.reasons.some(r => r.label === 'Potion slots full') && (
                    <div className="mt-1 text-[10px] text-amber-400/80 italic">Potion slots full — would need to discard a held potion</div>
                  )}
                  {item.reasons.length === 0 && item.type === 'card' && (
                    <div className="mt-1 text-[10px] text-white/25 italic">No strong synergy with current build</div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
