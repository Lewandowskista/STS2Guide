import type { SynergyReason } from '@/types/advisor'

const TYPE_COLORS: Record<string, string> = {
  'power-scaling': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'draw-engine': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'block-scaling': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'exhaust-synergy': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'orb-synergy': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'energy-synergy': 'bg-green-500/20 text-green-300 border-green-500/30',
  'keyword-match': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  'multi-hit': 'bg-red-500/20 text-red-300 border-red-500/30',
  'relic-amplification': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'status-inflict': 'bg-green-700/20 text-green-400 border-green-700/30',
  'power-combo': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'pet-synergy': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'combo': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  'archetype-fit': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  'archetype-core': 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50',
  'secondary-synergy': 'bg-indigo-400/15 text-indigo-400 border-indigo-400/25',
  'anti-synergy': 'bg-red-900/20 text-red-400 border-red-700/30',
  'diminishing-returns': 'bg-gray-600/20 text-gray-400 border-gray-600/30',
  'deck-quality': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
}

interface Props {
  reason: SynergyReason
  showDescription?: boolean
}

export function SynergyTag({ reason, showDescription = false }: Props) {
  const colors = TYPE_COLORS[reason.type] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  const isNegative = reason.weight < 0

  return (
    <div
      className={`text-xs px-2 py-0.5 rounded border ${colors} ${isNegative ? 'opacity-70' : ''}`}
      title={reason.description}
    >
      {isNegative ? '⚠ ' : ''}
      {reason.label}
      {showDescription && <span className="ml-1 opacity-70">— {reason.description}</span>}
    </div>
  )
}
