// Types mirroring the STS2MCP HTTP API responses from localhost:15526

export type EncounterType = 'monster' | 'elite' | 'boss'

export type StateType =
  | 'menu'
  | 'unknown'
  | 'monster'
  | 'elite'
  | 'boss'
  | 'hand_select'
  | 'rewards'
  | 'card_reward'
  | 'map'
  | 'event'
  | 'rest_site'
  | 'shop'
  | 'fake_merchant'
  | 'treasure'
  | 'card_select'
  | 'bundle_select'
  | 'relic_select'
  | 'crystal_sphere'
  | 'overlay'
  | 'death'
  | 'victory'

export interface ActivePower {
  id: string
  name: string
  amount: number
  type?: string        // 'Buff' | 'Debuff'
  description?: string
  keywords?: Array<{ name: string; description: string }>
}

export interface GameCard {
  id?: string          // only present in hand, not draw/discard pile
  name: string
  cost: string | number  // API returns string e.g. "1", "X"
  star_cost?: number | null
  type?: string
  rarity?: string
  is_upgraded?: boolean
  description?: string
  keywords?: Array<{ name: string; description: string }>
  index?: number
  target_type?: string  // e.g. 'AnyEnemy', 'Self', 'AllEnemy'
  can_play?: boolean
  unplayable_reason?: string | null
}

// Derive encounter type from state_type
export function getEncounterType(stateType: StateType): EncounterType | null {
  if (stateType === 'monster') return 'monster'
  if (stateType === 'elite') return 'elite'
  if (stateType === 'boss') return 'boss'
  return null
}

// Helper to get numeric cost from a GameCard
export function cardCost(card: GameCard): number {
  if (typeof card.cost === 'number') return card.cost
  const n = parseInt(card.cost as string, 10)
  return isNaN(n) ? 0 : n
}

export interface GameRelic {
  id: string
  name: string
  description?: string
  counter?: number | null
  keywords?: Array<{ name: string; description: string }>
}

export interface GamePotion {
  id: string
  name: string
  slot?: number
}

export interface Orb {
  id: string
  name: string
  description?: string
  passive_val: number
  evoke_val: number
  keywords?: Array<{ name: string; description: string }>
}

export interface Pet {
  id: string
  name: string
  hp: number
  max_hp: number
  powers: ActivePower[]
}

export interface PlayerState {
  character: string
  hp: number
  max_hp: number
  block: number
  energy: number
  max_energy: number
  gold: number
  stars?: number        // may not be present
  hand?: GameCard[]
  draw_pile?: GameCard[]
  discard_pile?: GameCard[]
  exhaust_pile?: GameCard[]
  draw_pile_count: number
  discard_pile_count: number
  exhaust_pile_count?: number
  orbs: Orb[]
  orb_slots?: number
  orb_empty_slots?: number
  pets?: Pet[]
  status: ActivePower[]
  powers?: ActivePower[]   // persistent powers (Strength, Dexterity, Focus, etc.) — separate from transient combat status
  relics: GameRelic[]
  potions?: GamePotion[]
}

export interface EnemyIntent {
  type: string         // 'Attack', 'Defend', 'Buff', 'Unknown', etc.
  label?: string       // e.g. "3x2" = 3 dmg x 2 hits, "8" = 8 dmg
  title?: string       // e.g. "Aggressive"
  description?: string // e.g. "This enemy intends to Attack for 3 damage 2 times."
}

// Parse damage and hit count from intent label like "3x2", "8", "12x3"
export function parseIntentDamage(intent: EnemyIntent): { damage: number; times: number } | null {
  if (!intent.type?.toLowerCase().includes('attack') && intent.type !== 'Attack') return null
  const label = intent.label ?? ''
  const xMatch = label.match(/^(\d+)x(\d+)$/)
  if (xMatch) return { damage: parseInt(xMatch[1]), times: parseInt(xMatch[2]) }
  const numMatch = label.match(/^(\d+)$/)
  if (numMatch) return { damage: parseInt(numMatch[1]), times: 1 }
  // Fall back to parsing description
  const descMatch = intent.description?.match(/(\d+) damage (\d+) times/)
  if (descMatch) return { damage: parseInt(descMatch[1]), times: parseInt(descMatch[2]) }
  const descSingle = intent.description?.match(/(\d+) damage/)
  if (descSingle) return { damage: parseInt(descSingle[1]), times: 1 }
  return null
}

export interface Enemy {
  entity_id: string
  combat_id: number
  name: string
  hp: number
  max_hp: number
  block: number
  status: ActivePower[]
  intents: EnemyIntent[]
  move_name?: string
}

export interface BattleState {
  round: number
  turn: string
  is_play_phase: boolean
  enemies: Enemy[]
}

export interface MapNode {
  col: number
  row: number
  type: string           // 'Monster' | 'Elite' | 'Boss' | 'RestSite' | 'Shop' | 'Unknown' | 'Treasure' | 'Ancient'
  index?: number
  leads_to?: Array<{ col: number; row: number; type: string }>
  children?: Array<[number, number]>  // used in nodes list
}

export interface MapState {
  current_position?: { col: number; row: number; type: string }
  visited?: Array<{ col: number; row: number; type: string }>
  next_options?: MapNode[]
  nodes?: MapNode[]
  boss?: { col: number; row: number }
}

export interface ShopItem {
  index?: number
  // Actual STS2 API fields
  category?: 'card' | 'relic' | 'potion' | 'card_removal'
  price: number
  is_stocked?: boolean
  can_afford?: boolean
  on_sale?: boolean
  // Card fields
  card_id?: string
  card_name?: string
  card_type?: string
  card_cost?: string | number
  card_star_cost?: number | null
  card_rarity?: string
  card_description?: string
  // Relic fields
  relic_id?: string
  relic_name?: string
  relic_description?: string
  // Potion fields
  potion_id?: string
  potion_name?: string
  potion_description?: string
  // Shared
  keywords?: Array<{ name: string; description: string }>
  // Legacy / fallback fields (older API versions)
  id?: string
  name?: string
  type?: 'card' | 'relic' | 'potion' | 'remove'
  card?: GameCard
  relic?: GameRelic
  potion?: GamePotion
  description?: string
  rarity?: string
  cost?: string | number
  is_upgraded?: boolean
  target_type?: string
  can_play?: boolean
}

export interface ShopState {
  gold?: number
  items: ShopItem[]
  can_remove?: boolean
  remove_cost?: number
}

export interface EventOption {
  index: number
  title: string           // API uses "title" not "label"
  description: string
  is_locked?: boolean
  is_proceed?: boolean
  was_chosen?: boolean
  relic_name?: string
  relic_description?: string
  keywords?: Array<{ name: string; description: string }>
}

export interface EventState {
  event_id: string
  event_name: string      // API uses "event_name" not "name"
  is_ancient?: boolean    // true when at the Neow/ancient screen
  in_dialogue?: boolean
  body?: string | null
  options: EventOption[]
}

export interface CardRewardState {
  cards: GameCard[]
  can_skip?: boolean
}

export interface RelicSelectState {
  relics: GameRelic[]
  source?: string
  ancient_id?: string
}

export interface RestSiteState {
  can_rest?: boolean
  can_smith?: boolean
  can_lift?: boolean
  can_toke?: boolean
  can_dig?: boolean
  can_recall?: boolean
  rest_amount?: number
  card_to_upgrade?: GameCard
}

export interface RewardItem {
  index: number
  type: string        // 'card' | 'relic' | 'potion' | 'gold'
  description: string
}

export interface RewardsState {
  items: RewardItem[]
  can_proceed: boolean
}

export interface RunState {
  act: number
  floor: number
  ascension?: number
  seed?: string
  game_mode?: string
}

export interface GameState {
  state_type: StateType
  message?: string
  run?: RunState
  player?: PlayerState
  battle?: BattleState
  map?: MapState
  shop?: ShopState
  event?: EventState
  card_reward?: CardRewardState
  relic_select?: RelicSelectState
  rest_site?: RestSiteState
  rewards?: RewardsState
  cards_to_select?: GameCard[]
  cards_to_select_count?: number
  select_title?: string
}
