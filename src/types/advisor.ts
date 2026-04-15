import type { GameCard, GameRelic, EncounterType } from './game-state'
import type { CodexCard } from './codex'
import type { BuildTarget } from '@/engine/meta-builds'

export type LetterRating = 'S' | 'A' | 'B' | 'C' | 'D' | 'F'

export function scoreToRating(score: number): LetterRating {
  if (score >= 9) return 'S'
  if (score >= 7.5) return 'A'
  if (score >= 6) return 'B'
  if (score >= 4.5) return 'C'
  if (score >= 3) return 'D'
  return 'F'
}

export interface SynergyReason {
  type: string
  label: string
  description: string
  weight: number
}

export interface CardEvaluation {
  card: GameCard
  codexCard: CodexCard | null
  score: number // 1-10
  rating: LetterRating
  reasons: SynergyReason[]
  isSkipBetter?: boolean
  scalingNote?: string        // e.g. "Scales well into Act 3"
  redundancyNote?: string     // e.g. "Already have 3 draw cards"
  upcomingThreatFit?: string  // e.g. "Good vs incoming boss"
  isCoreCard?: boolean        // true when this is a core card for an active build target
}

export interface RelicEvaluation {
  relic: GameRelic
  score: number
  rating: LetterRating
  reasons: SynergyReason[]
}

export interface PathScore {
  node: { x: number; y: number; type: string }
  score: number
  label: string
  reasons: string[]          // up to 3 reasons
  risk: 'low' | 'medium' | 'high'
  deckFitNote?: string       // e.g. "Your poison deck wants this shop"
  bossPrep?: boolean         // true when this path helps prepare for boss
  eliteDifficulty?: 'easy' | 'neutral' | 'hard' // based on deck matchup
  /** True on the single best-scored option when there is a meaningful gap */
  isBest?: boolean
  /** One-sentence recommendation for this path */
  summary?: string
  /** Estimated HP % after resting (only for RestSite nodes) */
  hpAfterRest?: number
  /** Gold needed vs gold available context (only for Shop nodes) */
  shopAffordability?: 'rich' | 'okay' | 'tight'
  /** Depth-2 lookahead node types the path leads toward */
  futureNodes?: string[]
}

export interface CombatTurn {
  totalDamage: number
  sources: Array<{ enemyName: string; damage: number; moveType: string }>
  isLethal: boolean
  blockNeeded: number
}

export interface PlaySuggestion {
  card: GameCard
  reason: string
  priority: number
}

export type CombatBuildLensId =
  | 'auto'
  | 'strength'
  | 'exhaust'
  | 'block'
  | 'poison'
  | 'shiv'
  | 'discard'
  | 'orb-focus'
  | 'frost-control'
  | 'lightning-tempo'
  | 'star-economy'
  | 'creation-forging'
  | 'skill-tempo'
  | 'osty-aggro'
  | 'doom-debuff'
  | 'ethereal-tempo'

export interface CombatBuildLensOption {
  id: CombatBuildLensId
  label: string
}

export interface CombatActionStep {
  type: 'card' | 'potion' | 'end-turn'
  label: string
  reason: string
  priority: number
  card?: GameCard
  targetEnemyName?: string
  potionName?: string
}

export interface CombatCandidateLine {
  id: string
  summary: string
  score: number
  netIncomingDamage: number
  estimatedEnemyDamage: number
  estimatedBlock: number
  lethalNow: boolean
  survivesIncoming: boolean
  steps: CombatActionStep[]
  suggestedPlay: PlaySuggestion[]
  potionSuggestion?: string
}

export type { EncounterType }

export type EnemyThreatLevel = 'low' | 'medium' | 'high' | 'lethal'

export interface BossContext {
  bossName: string
  threatMoves: Array<{ name: string; description: string; turnEstimate?: number }>
  counterAdvice: string
  deckReadiness: number  // 1-10
  missingPieces: string[]
}

export interface EliteContext {
  eliteName: string
  dangerAbilities: string[]
  recommendedStrategy: string
  avoidCards: string[]   // card names/types to avoid playing
  rewardQuality: 'low' | 'medium' | 'high'
}

export interface CombatAdvice {
  combatKey: string
  characterId: string
  encounterType: EncounterType
  enemyThreatLevel: EnemyThreatLevel
  currentTurn: CombatTurn
  nextTurnPreview: CombatTurn | null
  isLethal: boolean
  candidateLines: CombatCandidateLine[]
  availableBuildLenses: CombatBuildLensOption[]
  selectedLineIndex: number
  selectedBuildLensId: CombatBuildLensId
  selectedBuildLensLabel: string
  autoBuildLensId: CombatBuildLensId
  autoBuildLensLabel: string
  suggestedPlay: PlaySuggestion[]
  potionSuggestion?: string
  summary: string
  bossContext?: BossContext
  eliteContext?: EliteContext
  availableEnergy: number
  maxEnergy: number
  // Buff/debuff/conditional-card alerts for this turn
  activeEffectNotes: string[]
  // Priority target in multi-enemy fights
  priorityTarget?: string
}

export interface EventOptionAnalysis {
  optionId: string
  label: string
  outcomes: string[]
  recommendation: 'take' | 'avoid' | 'situational'
  reason: string
  isLocked?: boolean
  isProceed?: boolean
  goldCost?: number
  /** Numeric score for ranking among options — higher is better. Locked/proceed options are excluded. */
  score?: number
  /** True on the single highest-scored non-locked non-proceed option */
  isBest?: boolean
}

export interface EventAnalysis {
  eventId: string
  isAncient: boolean
  optionAnalyses: EventOptionAnalysis[]
  summary: string
  /** Label of the single recommended option (the best pick overall) */
  bestOptionLabel?: string
}

export type ArchetypeId =
  | 'strength-scaling'
  | 'block-turtle'
  | 'draw-engine'
  | 'exhaust'
  | 'orb-focus'
  | 'poison'
  | 'shiv'
  | 'discard'
  | 'powers-heavy'
  | 'pet-synergy'
  | 'star-engine'
  | 'balanced'

export interface DeckArchetype {
  primary: ArchetypeId
  secondary: ArchetypeId | null
  confidence: number // 0-1
  label: string
}

export interface DeckWeakness {
  type: 'no-aoe' | 'no-scaling' | 'no-draw' | 'no-block' | 'no-damage' | 'too-large' | 'too-small' | 'curse-heavy'
  label: string
  severity: 'minor' | 'major'
}

export interface DeckAnalysis {
  archetype: DeckArchetype
  weaknesses: DeckWeakness[]
  cardTypeBreakdown: { attack: number; skill: number; power: number; curse: number; other: number }
  avgCost: number
  totalCards: number
  keySynergies: SynergyReason[]
  powerLevel: number     // 1-10 composite deck strength
  winCondition?: string  // e.g. "Stack Poison to 50+ by turn 5"
  buildTargets?: BuildTarget[]  // active meta build targets, sorted by completion
  archetypeLockWarning?: string  // shown when floor ≥ 15 and archetype confidence is low
}

export type { BuildTarget }

export interface ShopItemEvaluation {
  itemId: string | undefined
  name: string
  type: 'card' | 'relic' | 'potion' | 'remove'
  price: number
  score: number
  rating: LetterRating
  reasons: SynergyReason[]
  worthBuying: boolean
  removalTarget?: string   // card name recommended to remove
  goldFloor?: number       // minimum gold to hold for next shop
  preBossUrgency?: boolean // boss is ≤3 floors away
  isCoreCard?: boolean     // true when this card is a core card for an active build target
}

export type RestAction = 'rest' | 'smith' | 'lift' | 'toke' | 'dig' | 'recall'

export interface RestSiteAdvice {
  recommended: RestAction
  reason: string
  actions: Array<{
    action: RestAction
    available: boolean
    label: string
    advice: string
    priority: number  // 1 = best
  }>
}

export interface AdvisorState {
  // Per-screen recommendations
  cardRatings: CardEvaluation[] | null
  combatAdvice: CombatAdvice | null
  pathScores: PathScore[] | null
  relicRatings: RelicEvaluation[] | null
  eventAnalysis: EventAnalysis | null
  shopEvaluations: ShopItemEvaluation[] | null
  restSiteAdvice: RestSiteAdvice | null

  // Persistent run analysis
  deckAnalysis: DeckAnalysis | null

  // Status
  isCalculating: boolean
  lastCalculatedAt: number

  // Combat planner UI state
  selectedCombatLineIndex: number
  selectedBuildLensByClass: Partial<Record<string, CombatBuildLensId>>
  activeCombatKey: string | null
}
