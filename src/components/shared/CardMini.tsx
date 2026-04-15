import type { GameCard } from '@/types/game-state'
import type { LetterRating } from '@/types/advisor'
import { RatingBadge } from './RatingBadge'

interface Props {
  card: GameCard
  rating?: LetterRating
  score?: number
  reason?: string
  isTop?: boolean
}

export function CardMini({ card, rating, score, reason, isTop }: Props) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isTop ? 'bg-white/10 ring-1 ring-white/20' : 'bg-white/5'}`}>
      {rating && <RatingBadge rating={rating} size="sm" />}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium truncate">{card.name}</div>
        {reason && <div className="text-xs text-white/50 truncate">{reason}</div>}
      </div>
      {score !== undefined && (
        <div className="text-xs text-white/60 shrink-0">{score.toFixed(1)}</div>
      )}
    </div>
  )
}
