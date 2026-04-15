import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Map, ChevronDown, Star, Skull, Coins, Heart, Flame } from 'lucide-react'
import { useAdvisorStore } from '@/stores/advisor-store'
import { useGameState } from '@/hooks/useGameState'

const RISK_COLORS = {
  low:    'border-green-700/40 bg-green-900/20',
  medium: 'border-yellow-700/40 bg-yellow-900/20',
  high:   'border-red-700/40 bg-red-900/20',
}

const ELITE_DIFFICULTY_COLORS = {
  easy:    'text-green-300 bg-green-900/30',
  neutral: 'text-yellow-300 bg-yellow-900/20',
  hard:    'text-red-300 bg-red-900/30',
}

const SHOP_AFFORD_COLORS = {
  rich:  'text-green-300',
  okay:  'text-yellow-300',
  tight: 'text-red-300',
}

const SHOP_AFFORD_LABELS = {
  rich:  'Rich',
  okay:  'Okay',
  tight: 'Tight on gold',
}

const TYPE_ICONS: Record<string, string> = {
  Monster:  '⚔',
  Elite:    '⚡',
  RestSite: '🔥',
  Shop:     '🛒',
  Unknown:  '?',
  Treasure: '🎁',
  Ancient:  '✨',
  Boss:     '💀',
}

const TYPE_COLORS: Record<string, string> = {
  Monster:  'bg-slate-700/40 text-slate-200',
  Elite:    'bg-purple-900/40 text-purple-200',
  RestSite: 'bg-orange-900/40 text-orange-200',
  Shop:     'bg-blue-900/40 text-blue-200',
  Unknown:  'bg-teal-900/40 text-teal-200',
  Treasure: 'bg-yellow-900/40 text-yellow-200',
  Ancient:  'bg-amber-900/40 text-amber-200',
  Boss:     'bg-red-900/40 text-red-200',
}

function nodeChip(type: string) {
  const colors = TYPE_COLORS[type] ?? 'bg-white/10 text-white/70'
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${colors}`}>
      {TYPE_ICONS[type] ?? '·'} {type}
    </span>
  )
}

export function MapPanel() {
  const pathScores = useAdvisorStore(s => s.pathScores)
  const state = useGameState()
  const [expanded, setExpanded] = useState(true)

  if (!pathScores?.length) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        className="fixed right-1 top-1 w-64 bg-black/80 backdrop-blur rounded-xl border border-white/10 p-3"
        onMouseEnter={() => window.stsApi.setInteractive(true)}
        onMouseLeave={() => window.stsApi.setInteractive(false)}
      >
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <Map size={14} />
          <span>Path Advisor</span>
        </div>
        <div className="text-xs text-white/30 mt-1">Reading map…</div>
      </motion.div>
    )
  }

  const options = state?.map?.next_options ?? []
  const hpPct = state?.player ? state.player.hp / state.player.max_hp : 1
  const hasBossPrep = pathScores.some(p => p.bossPrep)
  const bestPath = pathScores.find(p => p.isBest)

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className="fixed right-1 top-1 w-64 max-h-[calc(100vh-80px)] overflow-y-auto bg-black/80 backdrop-blur rounded-xl border border-white/10"
      onMouseEnter={() => window.stsApi.setInteractive(true)}
      onMouseLeave={() => window.stsApi.setInteractive(false)}
    >
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2 text-white/80 min-w-0">
          <Map size={14} className="shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium">Path Advisor</span>
            {bestPath && (
              <span className="text-[10px] text-amber-400/80 truncate">
                Best: {bestPath.node.type}
              </span>
            )}
          </div>
          {hasBossPrep && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 flex items-center gap-1 shrink-0 ml-auto">
              <Skull size={10} /> Boss soon
            </span>
          )}
        </div>
        <ChevronDown size={14} className={`text-white/40 transition-transform shrink-0 ml-1 ${expanded ? '' : '-rotate-90'}`} />
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
              {/* Critical HP warning */}
              {hpPct < 0.4 && (
                <div className="text-xs text-red-300 bg-red-900/20 border border-red-700/30 px-2 py-1 rounded flex items-center gap-1.5">
                  <Heart size={10} className="text-red-400 shrink-0" />
                  Low HP — prioritize rest sites
                </div>
              )}

              {pathScores.map((path, i) => {
                const rawNode = options[i]
                const ahead = rawNode?.leads_to ?? []
                const isBest = path.isBest === true

                return (
                  <div
                    key={i}
                    className={`rounded-lg px-2 py-1.5 border text-xs ${
                      isBest
                        ? 'border-amber-500/50 bg-amber-900/15 ring-1 ring-amber-500/20'
                        : RISK_COLORS[path.risk]
                    }`}
                  >
                    {/* Header row: node type + badges + score */}
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <div className="flex items-center gap-1 flex-wrap min-w-0">
                        {nodeChip(path.node.type)}

                        {/* BEST badge */}
                        {isBest && (
                          <span className="flex items-center gap-0.5 px-1 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-amber-400 text-[9px] font-bold uppercase tracking-wide">
                            <Star size={7} />BEST
                          </span>
                        )}

                        {/* Boss prep badge */}
                        {path.bossPrep && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-red-900/40 text-red-300">Boss Prep</span>
                        )}

                        {/* Elite difficulty */}
                        {path.node.type === 'Elite' && path.eliteDifficulty && (
                          <span className={`text-[9px] px-1 py-0.5 rounded ${ELITE_DIFFICULTY_COLORS[path.eliteDifficulty]}`}>
                            {path.eliteDifficulty}
                          </span>
                        )}
                      </div>

                      {/* Shop affordability indicator */}
                      {path.node.type === 'Shop' && path.shopAffordability && (
                        <span className={`text-[9px] shrink-0 ${SHOP_AFFORD_COLORS[path.shopAffordability]}`}>
                          {SHOP_AFFORD_LABELS[path.shopAffordability]}
                        </span>
                      )}

                      {/* HP after rest */}
                      {path.node.type === 'RestSite' && path.hpAfterRest !== undefined && (
                        <span className="text-[9px] text-orange-300/70 shrink-0 flex items-center gap-0.5">
                          <Heart size={8} />{Math.round(path.hpAfterRest * 100)}% after rest
                        </span>
                      )}
                    </div>

                    {/* Summary sentence */}
                    {path.summary && (
                      <div className={`text-[11px] mb-1 ${isBest ? 'text-amber-200/80' : 'text-white/70'}`}>
                        {path.summary}
                      </div>
                    )}

                    {/* Lookahead: immediate leads_to */}
                    {ahead.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        <span className="text-white/30 text-[10px]">then</span>
                        {ahead.slice(0, 3).map((n, j) => (
                          <span key={j}>{nodeChip(n.type)}</span>
                        ))}
                      </div>
                    )}

                    {/* Depth-2 future nodes (distinct from depth-1) */}
                    {path.futureNodes && path.futureNodes.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        <span className="text-white/20 text-[10px]">and beyond</span>
                        {path.futureNodes.map((t, j) => (
                          <span key={j}>{nodeChip(t)}</span>
                        ))}
                      </div>
                    )}

                    {/* Reasons */}
                    {path.reasons.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {path.reasons.map((r, j) => (
                          <div key={j} className="text-white/45 flex items-start gap-1">
                            <span className="text-white/25 mt-0.5">·</span>
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Deck fit note */}
                    {path.deckFitNote && (
                      <div className="mt-1 text-blue-300/70 italic text-[10px]">{path.deckFitNote}</div>
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
