import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gem, ChevronDown } from 'lucide-react'
import { useAdvisorStore } from '@/stores/advisor-store'
import { RatingBadge } from '../shared/RatingBadge'
import { SynergyTag } from '../shared/SynergyTag'

export function RelicPanel() {
  const relicRatings = useAdvisorStore(s => s.relicRatings)
  const [expanded, setExpanded] = useState(true)

  if (!relicRatings?.length) {
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
          <Gem size={14} />
          <span>Relic Advisor</span>
        </div>
        <div className="text-xs text-white/30 mt-1">Evaluating relics…</div>
      </motion.div>
    )
  }

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
          <Gem size={14} />
          <span className="text-sm font-medium">Relic Advisor</span>
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
              {relicRatings.map((evaluation, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-2 ${i === 0 ? 'bg-white/10 ring-1 ring-white/20' : 'bg-white/5'}`}
                >
                  <div className="flex items-center gap-2">
                    <RatingBadge rating={evaluation.rating} score={evaluation.score} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium truncate">{evaluation.relic.name}</div>
                    </div>
                  </div>
                  {evaluation.relic.description && (
                    <div className="mt-1 text-xs text-white/50 line-clamp-2">{evaluation.relic.description}</div>
                  )}
                  {evaluation.reasons.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {evaluation.reasons.slice(0, 2).map((r, j) => (
                        <SynergyTag key={j} reason={r} />
                      ))}
                    </div>
                  )}
                  {evaluation.reasons[0] && (
                    <div className="mt-1 text-xs text-white/40 line-clamp-1">
                      {evaluation.reasons[0].description}
                    </div>
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
