import type { CodexCard, CodexRelic } from './codex'
import type { ActivePower, GameCard, GameRelic } from './game-state'
import type { ArchetypeId, DeckArchetype } from './advisor'

export type SynergyEdgeType =
  | 'power-scaling'    // strength/dexterity + cards that benefit
  | 'draw-engine'      // draw sources + cheap/free cards
  | 'block-scaling'    // block scaling sources
  | 'exhaust-synergy'  // exhaust triggers + exhaust cards
  | 'orb-synergy'      // orb generators + orb payoffs
  | 'energy-synergy'   // energy generation + energy hungry cards
  | 'keyword-match'    // shared keywords
  | 'power-combo'      // powers that amplify each other
  | 'relic-amplification' // relic benefits card type/keyword
  | 'multi-hit'        // multi-hit cards + damage amplifiers
  | 'heal-scaling'     // healing synergies
  | 'status-inflict'   // status infliction + status exploiters
  | 'pet-synergy'      // pet interaction cards/relics
  | 'combo'            // explicit card-to-card combo
  | 'archetype-fit'    // card reinforces detected archetype
  | 'archetype-core'   // core relic for detected archetype
  | 'secondary-synergy'// secondary archetype synergy
  | 'anti-synergy'     // card/relic conflicts with build
  | 'diminishing-returns' // effect already covered by existing items
  | 'deck-quality'     // general deck quality assessment

export interface SynergyEdge {
  sourceId: string  // card or relic id
  targetId: string  // card or relic id
  type: SynergyEdgeType
  weight: number    // 0.0 - 1.0
  label: string
  description: string
}

export interface SynergyGraph {
  edges: SynergyEdge[]
  nodeIds: Set<string>
}

export interface SynergyContext {
  card: CodexCard
  deck: GameCard[]
  codexDeck: CodexCard[]
  relics: GameRelic[]
  codexRelics: CodexRelic[]
  powers: ActivePower[]
  archetype: DeckArchetype
  character: string
  act: number
  floor: number
}

export interface SynergyRule {
  id: string
  name: string
  edgeType: SynergyEdgeType
  baseWeight: number
  check: (ctx: SynergyContext) => boolean
  score: (ctx: SynergyContext) => number // -1.0 to 1.0
  describe: (ctx: SynergyContext) => string
}

// Archetype signal for detection
export type IndicatorType = 'card-keyword' | 'card-tag' | 'power-present' | 'relic-id' | 'card-type' | 'card-id'

export interface ArchetypeIndicator {
  type: IndicatorType
  match: string | string[]
  weight: number
}

export interface ArchetypeSignal {
  archetype: ArchetypeId
  label: string
  indicators: ArchetypeIndicator[]
  minScore: number // minimum indicator score to be considered
}
