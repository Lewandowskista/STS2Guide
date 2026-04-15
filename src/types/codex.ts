// Types mirroring the Spire Codex API (https://spire-codex.com)

export interface PowerApplied {
  power: string
  power_key: string | null
  amount: number
}

export interface CodexCard {
  id: string
  name: string
  description: string
  description_raw: string | null
  cost: number
  is_x_cost: boolean | null
  is_x_star_cost: boolean | null
  star_cost: number | null
  type: 'Attack' | 'Skill' | 'Power' | 'Curse' | 'Status' | 'Quest' | string
  type_key: string | null
  rarity: 'Starter' | 'Common' | 'Uncommon' | 'Rare' | 'Special' | string
  rarity_key: string | null
  target: string
  color: string
  damage: number | null
  block: number | null
  hit_count: number | null
  powers_applied: PowerApplied[] | null
  cards_draw: number | null
  energy_gain: number | null
  hp_loss: number | null
  keywords: string[] | null
  keywords_key: string[] | null
  tags: string[] | null
  spawns_cards: string[] | null
  vars: Record<string, unknown> | null
  upgrade: Record<string, unknown> | null
  upgrade_description: string | null
  image_url: string | null
  compendium_order: number
}

export interface MerchantPrice {
  base: number
  min: number
  max: number
}

export interface CodexRelic {
  id: string
  name: string
  description: string
  description_raw: string | null
  flavor: string | null
  rarity: 'Starter' | 'Common' | 'Uncommon' | 'Rare' | 'Boss' | 'Special' | string
  rarity_key: string | null
  pool: string
  merchant_price: MerchantPrice | null
  image_url: string | null
  compendium_order: number
}

export interface CodexPotion {
  id: string
  name: string
  description: string
  description_raw: string | null
  rarity: string
  rarity_key: string | null
  pool: string | null
  image_url: string | null
  compendium_order: number
}

export interface MonsterMoveDamage {
  normal: number
  ascension: number | null
  hit_count: number | null
}

export interface MonsterMovePower {
  power_id: string
  target: string
  amount: number
}

export interface MonsterMove {
  id: string
  name: string
  intent: string | null
  damage: MonsterMoveDamage | null
  block: number | null
  heal: number | null
  powers: MonsterMovePower[] | null
}

export interface AttackPatternBranch {
  move_id: string
  weight: number | null
  repeat: string | null
  max_times: number | null
  condition: string | null
}

export interface AttackPatternState {
  id: string
  type: 'move' | 'random' | 'conditional' | 'sequential' | string
  move_id: string | null
  must_perform_once: boolean | null
  next: string | null
  branches: AttackPatternBranch[] | null
}

export interface AttackPattern {
  type: 'cycle' | 'random' | 'conditional' | 'mixed' | string
  initial_move: string | null
  states: AttackPatternState[]
  description: string
}

export interface MonsterInnatePower {
  power_id: string
  amount: number
  amount_ascension: number | null
}

export interface MonsterEncounterRef {
  encounter_id: string
  encounter_name: string
  room_type: string
  act: string | null
  is_weak: boolean
}

export interface CodexMonster {
  id: string
  name: string
  type: 'Normal' | 'Elite' | 'Boss' | string
  min_hp: number | null
  max_hp: number | null
  min_hp_ascension: number | null
  max_hp_ascension: number | null
  moves: MonsterMove[] | null
  damage_values: Record<string, unknown> | null
  block_values: Record<string, unknown> | null
  encounters: MonsterEncounterRef[] | null
  innate_powers: MonsterInnatePower[] | null
  attack_pattern: AttackPattern | null
  image_url: string | null
}

export interface CodexPower {
  id: string
  name: string
  description: string
  description_raw: string | null
  type: string
  stack_type: string
  allow_negative: boolean | null
  image_url: string | null
}

export interface EncounterMonster {
  id: string
  name: string
}

export interface CodexEncounter {
  id: string
  name: string
  room_type: string
  is_weak: boolean
  act: string | null
  tags: string[] | null
  monsters: EncounterMonster[] | null
  loss_text: string | null
}

export interface EventOption {
  id: string
  title: string
  description: string
}

export interface EventPage {
  id: string
  description: string | null
  options: EventOption[] | null
}

export interface CodexEvent {
  id: string
  name: string
  type: string
  act: string | null
  description: string | null
  preconditions: string[] | null
  options: EventOption[] | null
  pages: EventPage[] | null
  epithet: string | null
  dialogue: Record<string, unknown> | null
  image_url: string | null
  relics: string[] | null
}

export interface CodexKeyword {
  id: string
  name: string
  description: string
}

export interface CodexOrb {
  id: string
  name: string
  description: string
  description_raw: string | null
  image_url: string | null
}

export interface CodexAffliction {
  id: string
  name: string
  description: string
  extra_card_text: string | null
  is_stackable: boolean
}

export interface CodexEnchantment {
  id: string
  name: string
  description: string
  description_raw: string | null
  extra_card_text: string | null
  card_type: string | null
  applicable_to: string | null
  is_stackable: boolean
  image_url: string | null
}

export interface AncientPool {
  name: string
  description?: string
  relics: Array<{ id: string; condition: string | null }>
}

export interface CodexAncient {
  id: string
  name: string
  description: string
  selection: string
  pools: AncientPool[]
}

export interface CodexAct {
  id: string
  name: string
  num_rooms: number | null
  bosses: string[]
  ancients: string[]
  events: string[]
  encounters: string[]
}

export interface CodexCharacter {
  id: string
  name: string
  description: string
  starting_hp: number | null
  starting_gold: number | null
  max_energy: number | null
  orb_slots: number | null
  starting_deck: string[]
  starting_relics: string[]
  color: string | null
  image_url: string | null
}

// Full codex data loaded into memory
export interface CodexData {
  cards: CodexCard[]
  relics: CodexRelic[]
  potions: CodexPotion[]
  monsters: CodexMonster[]
  powers: CodexPower[]
  encounters: CodexEncounter[]
  events: CodexEvent[]
  keywords: CodexKeyword[]
  enchantments: CodexEnchantment[]
  orbs: CodexOrb[]
  afflictions: CodexAffliction[]
  'ancient-pools': CodexAncient[]
  acts: CodexAct[]
  ascensions: Array<{ id: string; level: number; name: string; description: string }>
  characters: CodexCharacter[]
  epochs: unknown[]
  // Lookup maps (built at load time)
  cardById: Map<string, CodexCard>
  cardByName: Map<string, CodexCard>    // keyed by lowercase name
  relicById: Map<string, CodexRelic>
  relicByName: Map<string, CodexRelic>  // keyed by lowercase name
  potionById: Map<string, CodexPotion>
  potionByName: Map<string, CodexPotion> // keyed by lowercase name
  monsterById: Map<string, CodexMonster>
  eventById: Map<string, CodexEvent>
  encounterById: Map<string, CodexEncounter>
  powerById: Map<string, CodexPower>
  ancientById: Map<string, CodexAncient>
}

// Look up a card by id (hand cards) or name (draw/discard pile cards)
export function lookupCard(codex: CodexData, idOrName: string | undefined, name?: string): CodexCard | undefined {
  if (!codex) return undefined
  if (idOrName) {
    const byId = codex.cardById.get(idOrName)
    if (byId) return byId
  }
  const lookupName = (name ?? idOrName ?? '').toLowerCase()
  return codex.cardByName.get(lookupName)
}
