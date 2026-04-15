import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scroll, Sparkles, ChevronDown, Check, X, Minus, Lock, Coins, ArrowRight, Star } from 'lucide-react'
import { useAdvisorStore } from '@/stores/advisor-store'
import { useGameState } from '@/hooks/useGameState'

const REC_STYLES = {
  take:        { icon: Check,  color: 'text-green-400',  bg: 'bg-green-900/20 border-green-700/30' },
  avoid:       { icon: X,      color: 'text-red-400',    bg: 'bg-red-900/20 border-red-700/30' },
  situational: { icon: Minus,  color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/30' },
}

export function EventPanel() {
  const eventAnalysis = useAdvisorStore(s => s.eventAnalysis)
  const state = useGameState()
  const [expanded, setExpanded] = useState(true)

  if (!eventAnalysis) {
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
          <Scroll size={14} />
          <span>Event Advisor</span>
        </div>
        <div className="text-xs text-white/30 mt-1">Analyzing event…</div>
      </motion.div>
    )
  }

  const { isAncient, summary, optionAnalyses } = eventAnalysis
  const options = state?.event?.options ?? []
  const eventName = state?.event?.event_name

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
          {isAncient ? <Sparkles size={14} className="text-yellow-400 shrink-0" /> : <Scroll size={14} className="shrink-0" />}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium">
              {isAncient ? 'Ancient Bonus' : 'Event Advisor'}
            </span>
            {eventName && !isAncient && (
              <span className="text-[10px] text-white/40 truncate">{eventName}</span>
            )}
          </div>
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
              {/* Summary */}
              {summary && (
                <div className="text-xs text-white/40 pb-1 border-b border-white/5">{summary}</div>
              )}

              {optionAnalyses.map((opt, i) => {
                const rawOption = options[i]
                const isLocked = opt.isLocked
                const isProceed = opt.isProceed

                if (isLocked) {
                  return (
                    <div key={i} className="rounded-lg px-2 py-1.5 border border-white/5 bg-white/5 text-xs opacity-50">
                      <div className="flex items-center gap-1.5 text-white/40">
                        <Lock size={10} />
                        <span>{opt.label}</span>
                      </div>
                    </div>
                  )
                }

                if (isProceed) {
                  return (
                    <div key={i} className="rounded-lg px-2 py-1.5 border border-white/10 bg-white/5 text-xs">
                      <div className="flex items-center gap-1.5 text-white/50">
                        <ArrowRight size={10} />
                        <span>{opt.label}</span>
                      </div>
                    </div>
                  )
                }

                const style = REC_STYLES[opt.recommendation]
                const Icon = style.icon

                const isBest = opt.isBest === true

                return (
                  <div key={i} className={`rounded-lg px-2 py-1.5 border text-xs ${isBest ? 'border-amber-500/50 bg-amber-900/20' : style.bg}`}>
                    <div className="flex items-start gap-1.5">
                      <Icon size={12} className={`${style.color} mt-0.5 shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-white/90">{opt.label}</span>
                          {isBest && (
                            <span className="flex items-center gap-0.5 px-1 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-amber-400 text-[9px] font-bold uppercase tracking-wide">
                              <Star size={7} />BEST
                            </span>
                          )}
                          {opt.goldCost ? (
                            <span className="flex items-center gap-0.5 text-yellow-400 text-[10px]">
                              <Coins size={9} />{opt.goldCost}g
                            </span>
                          ) : null}
                        </div>

                        {/* Relic description for ancient options */}
                        {rawOption?.relic_description && (
                          <div className="mt-0.5 text-white/60 italic">{rawOption.relic_description}</div>
                        )}

                        {/* Option description if no relic */}
                        {!rawOption?.relic_description && opt.outcomes[0] && (
                          <div className="mt-0.5 text-white/50 line-clamp-2">{opt.outcomes[0]}</div>
                        )}

                        {/* Advisor reason */}
                        {opt.reason && opt.reason !== (rawOption?.relic_description ?? opt.outcomes[0]) && (
                          <div className={`mt-0.5 ${style.color} opacity-80`}>{opt.reason}</div>
                        )}

                        {/* Keywords */}
                        {rawOption?.keywords && rawOption.keywords.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {rawOption.keywords.map((kw, ki) => (
                              <span key={ki} className="px-1 py-0.5 bg-white/10 rounded text-white/50 text-[10px]">
                                {kw.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
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
