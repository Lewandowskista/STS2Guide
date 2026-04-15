import type { LetterRating } from '@/types/advisor'

const RATING_STYLES: Record<LetterRating, string> = {
  S: 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-300',
  A: 'bg-green-500 text-white',
  B: 'bg-blue-500 text-white',
  C: 'bg-gray-500 text-white',
  D: 'bg-orange-500 text-white',
  F: 'bg-red-600 text-white',
}

interface Props {
  rating: LetterRating
  score?: number
  size?: 'sm' | 'md' | 'lg'
}

export function RatingBadge({ rating, score, size = 'md' }: Props) {
  const sizes = { sm: 'w-6 h-6 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-10 h-10 text-base' }
  return (
    <div className={`rounded font-bold flex items-center justify-center ${sizes[size]} ${RATING_STYLES[rating]}`}>
      {rating}
      {score !== undefined && size === 'lg' && (
        <span className="text-xs ml-0.5 opacity-80">{score.toFixed(1)}</span>
      )}
    </div>
  )
}
