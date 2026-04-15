import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, ChevronDown, Heart, Sword, Trash2, Package, Zap } from 'lucide-react'
import { useAdvisorStore } from '@/stores/advisor-store'
import { useGameState } from '@/hooks/useGameState'
import type { RestAction } from '@/types/advisor'

const ACTION_ICONS: Record<RestAction, React.ElementType> = {
  rest:   Heart,
  smith:  Sword,
  toke:   Trash2,
  dig:    Package,
  lift:   Zap,
  recall: Flame,
}

const ACTION_COLORS: Record<RestAction, { bg: string; border: string; text: string; icon: string }> = {
  rest:   { bg: 'bg-green-900/25',  border: 'border-green-700/40',  text: 'text-green-200',  icon: 'text-green-400' },
  smith:  { bg: 'bg-blue-900/25',   border: 'border-blue-700/40',   text: 'text-blue-200',   icon: 'text-blue-400' },
  toke:   { bg: 'bg-purple-900/25', border: 'border-purple-700/40', text: 'text-purple-200', icon: 'text-purple-400' },
  dig:    { bg: 'bg-amber-900/25',  border: 'border-amber-700/40',  text: 'text-amber-200',  icon: 'text-amber-400' },
  lift:   { bg: 'bg-orange-900/25', border: 'border-orange-700/40', text: 'text-orange-200', icon: 'text-orange-400' },
  recall: { bg: 'bg-gray-800/40',   border: 'border-gray-600/30',   text: 'text-gray-300',   icon: 'text-gray-400' },
}

export function RestSitePanel() {
  const advice = useAdvisorStore(s => s.restSiteAdvice)
  const state = useGameState()
  const [expanded, setExpanded] = useState(true)

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
          <Flame size={14} />
          <span>Rest Site</span>
        </div>
        <div className="text-xs text-white/30 mt-1">Evaluating options…</div>
      </motion.div>
    )
  }

  if (!state?.player) return null

  const player = state.player
  const hpPct = player.hp / player.max_hp

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
          <Flame size={14} className="text-orange-400" />
          <span className="text-sm font-medium">Rest Site</span>
        </div>
        <div className="flex items-center gap-2">
          {/* HP bar */}
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  hpPct < 0.35 ? 'bg-red-500' : hpPct < 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${hpPct * 100}%` }}
              />
            </div>
            <span className="text-xs text-white/50">{player.hp}/{player.max_hp}</span>
          </div>
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
              {/* Top recommendation */}
              <div className="px-2 py-1.5 bg-white/5 rounded border border-white/10 text-xs text-white/60 leading-relaxed">
                {advice.reason}
              </div>

              {/* Action list */}
              {advice.actions.map((action, i) => {
                const colors = ACTION_COLORS[action.action]
                const Icon = ACTION_ICONS[action.action]
                const isRecommended = action.action === advice.recommended

                return (
                  <div
                    key={action.action}
                    className={`rounded-lg px-2.5 py-2 border text-xs ${
                      isRecommended
                        ? `${colors.bg} ${colors.border} ring-1 ring-white/10`
                        : action.available
                          ? 'bg-white/5 border-white/5'
                          : 'bg-white/3 border-white/5 opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={12} className={isRecommended ? colors.icon : 'text-white/30'} />
                      <span className={`font-medium ${isRecommended ? colors.text : 'text-white/50'}`}>
                        {action.label}
                      </span>
                      {isRecommended && (
                        <span className="ml-auto text-[10px] font-semibold text-white/40 uppercase tracking-wide">
                          #{i + 1}
                        </span>
                      )}
                    </div>
                    {action.available && (
                      <div className={`mt-0.5 pl-5 ${isRecommended ? 'text-white/60' : 'text-white/30'}`}>
                        {action.advice}
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
