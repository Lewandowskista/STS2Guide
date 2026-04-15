import type { CodexCard, CodexData, CodexPotion } from '@/types/codex'
import { lookupCard } from '@/types/codex'
import type {
  CombatActionStep,
  CombatAdvice,
  CombatBuildLensId,
  CombatCandidateLine,
  CombatTurn,
  DeckArchetype,
  PlaySuggestion,
} from '@/types/advisor'
import type { ActivePower, Enemy, GameCard, GamePotion, GameRelic, GameState, PlayerState } from '@/types/game-state'
import { cardCost, parseIntentDamage } from '@/types/game-state'
import {
  getCombatBuildOptions,
  getCombatBuildProfile,
  normalizeCharacterId,
  resolveAutoBuildLens,
} from './combat-builds'

const MAX_ACTION_DEPTH = 6
const MAX_BEAM_WIDTH = 24
const MAX_EVALUATED_STATES = 250

const PRIMARY_BUILD_TAG: Partial<Record<CombatBuildLensId, string>> = {
  strength: 'strength',
  exhaust: 'exhaust',
  block: 'block',
  poison: 'poison',
  shiv: 'shiv',
  discard: 'discard',
  'orb-focus': 'orb',
  'frost-control': 'frost',
  'lightning-tempo': 'lightning',
  'star-economy': 'star',
  'creation-forging': 'creation',
  'skill-tempo': 'skill',
  'osty-aggro': 'summon',
  'doom-debuff': 'doom',
  'ethereal-tempo': 'ethereal',
}

// Explicit tag overrides by card name (lowercase). Applied after text-based inference.
// Covers class-specific mechanics that pure text matching would miss.
const CARD_TAG_OVERRIDES: Record<string, string[]> = {
  // Ironclad
  'corruption': ['exhaust', 'skill', 'corruption-active'],
  'feel no pain': ['exhaust', 'payoff', 'block'],
  'dark embrace': ['exhaust', 'draw', 'payoff'],
  'limit break': ['strength', 'scaling', 'exhaust'],
  'body slam': ['block', 'burst', 'attack'],
  'juggernaut': ['block', 'attack', 'passive', 'payoff'],
  'demon form': ['strength', 'scaling'],
  'berserk': ['energy', 'setup'],
  'rupture': ['payoff', 'scaling'],
  'inflame': ['strength', 'scaling', 'setup'],
  'flex': ['strength', 'scaling', 'setup'],
  'spot weakness': ['strength', 'scaling', 'setup'],
  'clothesline': ['attack', 'weak', 'debuff'],
  'pommel strike': ['attack', 'draw'],
  'thunder clap': ['attack', 'vulnerable', 'debuff'],
  'whirlwind': ['attack', 'multiHit', 'burst'],
  'cleave': ['attack', 'burst'],
  'wild strike': ['attack', 'burst'],
  'reaper': ['attack', 'burst', 'exhaust'],
  'sword boomerang': ['attack', 'multiHit', 'burst'],
  'double tap': ['burst', 'payoff', 'scaling'],
  'battle trance': ['draw', 'energy'],
  'sentinel': ['exhaust', 'energy', 'payoff'],
  'power through': ['block', 'exhaust'],
  'warcry': ['draw', 'exhaust'],
  'metallicize': ['block', 'passive', 'scaling'],
  // Silent
  'accuracy': ['shiv', 'setup', 'payoff', 'scaling'],
  'catalyst': ['poison', 'payoff', 'setup', 'burst'],
  'thousand cuts': ['passive', 'payoff', 'shiv'],
  'after image': ['passive', 'payoff'],
  'caltrops': ['passive', 'payoff', 'block'],
  'blade dance': ['shiv', 'setup', 'multiHit'],
  'cloak and dagger': ['shiv', 'block', 'setup'],
  'hidden daggers': ['shiv', 'attack', 'multiHit'],
  'up my sleeve': ['shiv', 'setup'],
  'shadow step': ['discard', 'setup', 'scaling'], // discards hand, doubles next turn attacks
  'purity': ['exhaust', 'setup'],                  // exhausts up to 3 cards — curse removal
  'tactician': ['discard', 'payoff', 'energy'],
  'reflex': ['discard', 'payoff', 'draw'],
  'acrobatics': ['discard', 'draw'],
  'predator': ['attack', 'draw'],
  'prepared': ['draw', 'discard'],
  'survivor': ['block', 'discard'],
  'deadly poison': ['poison', 'setup', 'debuff'],
  'noxious fumes': ['poison', 'passive', 'setup', 'scaling'],
  'bouncing flask': ['poison', 'setup'],
  'corpse explosion': ['poison', 'burst', 'payoff', 'attack'],
  'envenom': ['poison', 'passive', 'setup', 'scaling'],
  'wraith form': ['discard', 'scaling', 'exhaust'],
  'crippling cloud': ['poison', 'weak', 'debuff'],
  'terror': ['exhaust', 'debuff'],
  'die die die': ['attack', 'burst', 'exhaust'],
  'infinite blades': ['shiv', 'passive', 'scaling'],
  'master of strategy': ['draw', 'exhaust'],
  'heel hook': ['attack', 'discard', 'draw'],
  'backflip': ['block', 'draw'],
  'setup': ['exhaust', 'setup', 'payoff'],
  'skewer': ['attack', 'burst'],
  // Defect
  'ball lightning': ['lightning', 'orb', 'attack'],
  'fission': ['lightning', 'orb', 'energy', 'burst'],
  'reprogram': ['orb', 'focus', 'setup', 'scaling'],
  'blizzard': ['frost', 'attack', 'payoff', 'burst'],
  'electrodynamics': ['lightning', 'orb', 'scaling', 'passive'],
  'defragment': ['focus', 'orb', 'scaling', 'setup'],
  'consume': ['orb', 'focus', 'scaling', 'setup'],
  'glacier': ['frost', 'orb', 'block'],
  'cold snap': ['frost', 'orb', 'block'],
  'chill': ['frost', 'orb', 'setup'],
  'white noise': ['orb', 'setup', 'energy'],
  'beam cell': ['lightning', 'attack', 'weak', 'debuff'],
  'doom and gloom': ['lightning', 'frost', 'orb', 'burst', 'attack'],
  'leap': ['block', 'frost'],
  'aggregate': ['orb', 'energy', 'payoff'],
  'turbo': ['energy', 'orb'],
  'go for the eyes': ['attack', 'weak', 'debuff'],
  'bullseye': ['attack', 'orb'],
  'hologram': ['block', 'orb'],
  'skim': ['draw'],
  'compile driver': ['attack', 'draw', 'orb'],
  'rainbow': ['orb', 'burst'],
  'recycle': ['exhaust', 'energy'],
  'amplify': ['orb', 'burst', 'payoff'],
  'meteor strike': ['orb', 'burst', 'attack'],
  'thunder strike': ['lightning', 'attack', 'burst'],
  'all for one': ['orb', 'burst', 'draw'],
  'loop': ['orb', 'passive', 'scaling'],
  'melter': ['attack', 'orb'],
  'capacitor': ['orb', 'scaling'],
  'equilibrium': ['block', 'draw', 'exhaust'],
}

// Relic bonus rule: (relicName, state, player, round) => bonus score points
interface RelicBonusRule {
  nameFragment: string
  score: (state: PlannerState, player: PlayerState, round: number) => number
}

const RELIC_BONUS_RULES: RelicBonusRule[] = [
  // Attack-count relics (refined: worth less if early round, more if turn >= 3)
  {
    nameFragment: 'shuriken',
    score: (state, _p, round) => state.attackCount >= 3 ? (round >= 3 ? 8 : 5) : 0,
  },
  {
    nameFragment: 'kunai',
    score: (state, _p, round) => state.attackCount >= 3 ? (round >= 3 ? 7 : 4) : 0,
  },
  {
    nameFragment: 'ornamental fan',
    score: (state, _p, round) => state.attackCount >= 3 ? (round >= 3 ? 6 : 3) : 0,
  },
  // Pen Nib: 10th attack deals double damage — fire at counter mod 10 == 9
  {
    nameFragment: 'pen nib',
    score: (state, _p) => state.attackCount >= 1 ? 10 : 0,
  },
  // Akabeko: first attack each combat gains +8 damage
  {
    nameFragment: 'akabeko',
    score: (state, _p, round) => state.attackCount >= 1 && round === 1 ? 6 : 0,
  },
  // Bag of Marbles: apply 1 Vulnerable at combat start
  {
    nameFragment: 'bag of marbles',
    score: (_state, _p, round) => round === 1 ? 4 : 0,
  },
  // Brimstone: +2 Strength to all at start of each turn
  {
    nameFragment: 'brimstone',
    score: (state) => state.attackCount >= 1 ? 5 : 0,
  },
  // Red Skull: when HP < 50%, +3 Strength
  {
    nameFragment: 'red skull',
    score: (_state, player) => player.hp / player.max_hp < 0.5 ? 6 : 0,
  },
  // Caltrops: whenever you Block, deal 3 damage to all enemies
  {
    nameFragment: 'caltrops',
    score: (state) => state.player.block >= 5 ? 4 : 0,
  },
  // Ninja Scroll: start with 3 Shivs
  {
    nameFragment: 'ninja scroll',
    score: (state, _p, round) => round === 1 && (state.tagCounts.shiv ?? 0) > 0 ? 5 : 0,
  },
  // Frozen Core: channel Frost when orb slots empty after turn
  {
    nameFragment: 'frozen core',
    score: (state) => (state.tagCounts.frost ?? 0) > 0 ? 4 : 0,
  },
  // Data Disk: +1 Focus (minor orb bonus)
  {
    nameFragment: 'data disk',
    score: (state) => (state.tagCounts.orb ?? 0) > 0 ? 3 : 0,
  },
  // Ice Cream: retain energy between turns (small multi-turn bonus)
  {
    nameFragment: 'ice cream',
    score: (state) => state.player.energy > 0 ? 3 : 0,
  },
  // Paper Frog: double block on one card
  {
    nameFragment: 'paper frog',
    score: (state) => state.player.block >= 8 ? 6 : 0,
  },
  // Paper Crane: double damage on one card
  {
    nameFragment: 'paper crane',
    score: (state) => state.damageDealt >= 12 ? 6 : 0,
  },
  // Odd Mushroom: when you lose HP, +2 Strength
  {
    nameFragment: 'odd mushroom',
    score: (state) => state.attackCount >= 1 ? 3 : 0,
  },
  // Nunchaku: every 10 attacks, gain 1 energy
  {
    nameFragment: 'nunchaku',
    score: (state, _p, round) => state.attackCount >= 3 ? (round >= 2 ? 5 : 3) : 0,
  },
  // Orichalcum: gain 6 block if end turn at 0 block — bonus for block-free aggressive turns
  {
    nameFragment: 'orichalcum',
    score: (state) => state.player.block === 0 && state.attackCount >= 1 ? 6 : 0,
  },
  // Centennial Puzzle: draw 3 cards on first HP loss — reward for still being at full HP
  {
    nameFragment: 'centennial puzzle',
    score: (_state, player) => player.hp === player.max_hp ? 4 : 0,
  },
  // Meat on the Bone: heal 12 HP at end of combat if HP < 50% — reduce block urgency near threshold
  {
    nameFragment: 'meat on the bone',
    score: (_state, player) => player.hp / player.max_hp < 0.5 ? 5 : 0,
  },
  // Molten Egg / Toxic Egg / Frozen Egg: cards of the relevant type start upgraded
  // (minor: just reward having relevant tag cards)
  {
    nameFragment: 'molten egg',
    score: (state) => state.attackCount >= 1 ? 2 : 0,
  },
  {
    nameFragment: 'toxic egg',
    score: (state) => (state.tagCounts.poison ?? 0) > 0 ? 2 : 0,
  },
  {
    nameFragment: 'frozen egg',
    score: (state) => (state.tagCounts.orb ?? 0) > 0 ? 2 : 0,
  },
  // Velvet Choker: can only play 6 cards per turn — penalise very long sequences
  {
    nameFragment: 'velvet choker',
    score: (state) => state.steps.length >= 6 ? -20 : 0,
  },
  // Snecko Eye: draw 2 extra cards, randomize costs — reward draw-heavy turns
  {
    nameFragment: 'snecko eye',
    score: (state) => state.drawValue >= 2 ? 4 : 0,
  },
  // Runic Dome: player can't see enemy intents — no mechanical change, no bonus
  // Wrist Blade: shivs deal +4 damage — reward shiv plays
  {
    nameFragment: 'wrist blade',
    score: (state) => (state.tagCounts.shiv ?? 0) >= 3 ? 6 : (state.tagCounts.shiv ?? 0) >= 1 ? 3 : 0,
  },
  // Leather Belt: whenever you play a Shiv, apply 1 Vulnerable to all enemies
  {
    nameFragment: 'leather belt',
    score: (state) => (state.tagCounts.shiv ?? 0) >= 2 ? 4 : 0,
  },
  // Unceasing Top: when hand is empty, draw a card — bonus for exhausting hand
  {
    nameFragment: 'unceasing top',
    score: (state) => state.remainingCards.length === 0 && state.drawPile.length > 0 ? 5 : 0,
  },
  // Tingsha: deal 3 damage to random enemy whenever you discard — reward discard plays
  {
    nameFragment: 'tingsha',
    score: (state) => (state.tagCounts.discard ?? 0) >= 2 ? 5 : 0,
  },
  // Tough Bandages: gain 3 block when you discard
  {
    nameFragment: 'tough bandages',
    score: (state) => (state.tagCounts.discard ?? 0) >= 2 ? 4 : 0,
  },
  // Rupture: gain strength when losing HP from cards — playing cards that cost HP is valuable
  {
    nameFragment: 'rupture',
    score: (_state, player) => player.hp / player.max_hp < 0.8 ? 3 : 0,
  },
  // Mummified Hand: when you play a Power, a random card costs 0 this turn
  {
    nameFragment: 'mummified hand',
    score: (state) => (state.tagCounts.scaling ?? 0) >= 1 ? 3 : 0,
  },
]

interface PlannerOptions {
  selectedBuildLensId: CombatBuildLensId
}

interface PlannerEnemyState {
  name: string
  hp: number
  block: number
  intentDamage: number
  intentHits: number
  weak: number
  vulnerable: number
  poison: number
  weakenedThisTurn: boolean
  vulnerableThisTurn: boolean
  // Enemy buffs that affect combat strategy
  thorns: number       // damages player on attack
  metallicize: number  // gains this much block each turn
  regeneration: number // heals this much per turn
}

interface PlannerPlayerState {
  hp: number
  max_hp: number
  block: number
  energy: number
  strength: number
  dexterity: number
  focus: number
  stars: number
}

interface PlannerAction {
  id: string
  type: 'card' | 'potion'
  label: string
  targetIndex?: number
  card?: GameCard
  codexCard?: CodexCard
  potion?: GamePotion
  codexPotion?: CodexPotion
  cost: number
  semantics: ActionSemantics
}

interface ActionSemantics {
  damage: number
  hitCount: number
  block: number
  draw: number
  energy: number
  heal: number
  applyStrength: number
  applyFocus: number
  applyWeak: number
  applyVulnerable: number
  applyPoison: number
  targetsAllEnemies: boolean
  targetSelf: boolean
  tags: string[]
  isAttack: boolean
  isCatalyst: boolean
}

interface PlannerState {
  player: PlannerPlayerState
  enemies: PlannerEnemyState[]
  remainingCards: GameCard[]
  drawPile: GameCard[]
  remainingPotions: GamePotion[]
  steps: CombatActionStep[]
  usedAllEnergy: boolean
  attackCount: number
  skillCount: number
  damageDealt: number
  tagCounts: Record<string, number>
  setupBeforeAttack: number
  poisonApplied: number
  relicBonus: number
  drawValue: number
  score: number
  // Combat state tracking for mechanics
  corruptionActive: boolean
  totalPoison: number
  // Player status flags (set at init, may change during simulation)
  playerFrail: boolean    // block reduced by 25%
  playerWeak: boolean     // attacks deal 25% less damage
  playerNoDraw: boolean   // cannot draw cards
  playerIntangible: boolean // takes 1 damage from all sources
  thornsDamageTaken: number // accumulated Thorns damage from attacking
}

function getPowerAmount(powers: ActivePower[] | null | undefined, id: string): number {
  return (powers ?? []).find(power => power.id?.toLowerCase().includes(id) || power.name?.toLowerCase().includes(id))?.amount ?? 0
}

function getEnemyPowerAmount(enemy: Enemy, id: string): number {
  return getPowerAmount(enemy.status ?? [], id)
}

function inferCardTags(card: GameCard, codexCard: CodexCard | undefined, semantics: ActionSemantics): string[] {
  const text = [
    card.name,
    card.description ?? '',
    codexCard?.description ?? '',
    ...(codexCard?.keywords ?? []),
    ...(codexCard?.tags ?? []),
  ].join(' ').toLowerCase()
  const tags = new Set<string>()

  if (codexCard?.type === 'Attack' || semantics.isAttack) tags.add('attack')
  if (codexCard?.type === 'Skill') tags.add('skill')
  if (semantics.block > 0) tags.add('block')
  if (semantics.hitCount > 1) tags.add('multiHit')
  if (semantics.damage >= 10 || semantics.hitCount > 1) tags.add('burst')
  if (semantics.draw > 0) tags.add('draw')
  if (semantics.energy > 0) tags.add('energy')
  if (semantics.applyPoison > 0 || text.includes('poison')) {
    tags.add('poison')
    tags.add('setup')
    tags.add('debuff')
  }
  if (semantics.applyWeak > 0 || text.includes('weak')) {
    tags.add('weak')
    tags.add('debuff')
    tags.add('setup')
  }
  if (semantics.applyVulnerable > 0 || text.includes('vulnerable')) {
    tags.add('vulnerable')
    tags.add('debuff')
    tags.add('setup')
  }
  if (semantics.applyStrength > 0 || text.includes('strength')) {
    tags.add('strength')
    tags.add('scaling')
    tags.add('setup')
  }
  if (semantics.applyFocus > 0 || text.includes('focus')) {
    tags.add('focus')
    tags.add('scaling')
    tags.add('setup')
  }
  if (text.includes('exhaust')) tags.add('exhaust')
  if (text.includes('discard')) tags.add('discard')
  if (text.includes('shiv')) tags.add('shiv')
  if (text.includes('channel') || text.includes('orb')) tags.add('orb')
  if (text.includes('lightning')) tags.add('lightning')
  if (text.includes('frost')) tags.add('frost')
  if (text.includes('star')) tags.add('star')
  if (text.includes('forge')) tags.add('forge')
  if (text.includes('creation')) tags.add('creation')
  if (text.includes('osty') || text.includes('summon') || text.includes('pet')) tags.add('summon')
  if (text.includes('doom')) tags.add('doom')
  if (text.includes('ethereal')) tags.add('ethereal')
  if (text.includes('retain')) tags.add('retain')

  // Apply explicit card name overrides for class-specific mechanics
  // Strip trailing '+' so upgraded card names (e.g. 'Corruption+') still match
  const overrides = CARD_TAG_OVERRIDES[card.name.toLowerCase().replace(/\+$/, '')]
  if (overrides) overrides.forEach(t => tags.add(t))

  return [...tags]
}

function extractFirstNumber(text: string): number {
  const match = text.match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

function inferPotionSemantics(potion: GamePotion, codexPotion: CodexPotion | undefined): ActionSemantics {
  const text = `${potion.name} ${codexPotion?.description ?? ''}`.toLowerCase()
  const block = text.includes('block') ? extractFirstNumber(text) : 0
  const damage = text.includes('damage') ? extractFirstNumber(text) : 0
  const heal = text.includes('heal') || text.includes('restore') ? extractFirstNumber(text) : 0
  const applyStrength = text.includes('strength') ? Math.max(1, extractFirstNumber(text)) : 0
  const applyWeak = text.includes('weak') ? Math.max(1, extractFirstNumber(text)) : 0
  const applyVulnerable = text.includes('vulnerable') ? Math.max(1, extractFirstNumber(text)) : 0
  const applyPoison = text.includes('poison') ? Math.max(1, extractFirstNumber(text)) : 0

  const tags: string[] = []
  if (block > 0) tags.push('block')
  if (damage > 0) tags.push('attack', 'burst')
  if (heal > 0) tags.push('block')
  if (applyStrength > 0) tags.push('strength', 'setup', 'scaling')
  if (applyWeak > 0) tags.push('weak', 'setup', 'debuff')
  if (applyVulnerable > 0) tags.push('vulnerable', 'setup', 'debuff')
  if (applyPoison > 0) tags.push('poison', 'setup', 'debuff')

  return {
    damage,
    hitCount: 1,
    block,
    draw: 0,
    energy: 0,
    heal,
    applyStrength,
    applyFocus: 0,
    applyWeak,
    applyVulnerable,
    applyPoison,
    targetsAllEnemies: text.includes('all enemies'),
    targetSelf: block > 0 || heal > 0 || applyStrength > 0,
    tags,
    isAttack: damage > 0,
    isCatalyst: false,
  }
}

// Cards where codex cards_draw is wrong. The codex conflates "add cards to hand" (tokens,
// copies, random cards) with "draw from draw pile". These cards should NOT be treated as
// draw cards by the planner because they don't cycle the deck or change hand card count
// in a meaningful way for planning purposes. Value 0 means suppress the codex draw value.
// Format: lowercase card name (without trailing +) => forced draw count
const CARD_DRAW_OVERRIDES: Record<string, number> = {
  // Silent — token generators (add Shivs/copies to hand, not deck draws)
  'blade dance': 0,           // adds 3 Shivs to hand
  'cloak and dagger': 0,      // adds 1 Shiv to hand
  'hidden daggers': 0,        // adds 2 Shivs to hand
  'up my sleeve': 0,          // adds 2 Shivs to hand
  'shadow step': 0,           // discards hand, doubles next turn attack damage — no draw
  // Silent — discard pile interaction (not deck draw)
  'purity': 0,                // exhausts up to 3 cards from hand, not draws
  // Ironclad
  'dual wield': 0,            // adds copy of a card to hand, not draw
  // Defect
  'jack of all trades': 0,    // adds random colorless card to hand
  // Watcher
  'ponder': 0,                // look at top 3 and pick one (not normal draw)
  // Regent
  'jackpot': 0,               // adds random rare card to hand
  'bundle of joy': 0,         // adds random cards to hand from market
  'spectrum shift': 0,        // adds random cards (not draw pile draws)
  'beat down': 0,             // plays attacks from discard, not draw
  'drain power': 0,           // interacts with discard/powers, no draw
  'dredge': 0,                // retrieves from discard pile, not draw
  'capture spirit': 0,        // adds Souls to draw pile (does not draw immediately)
  'foregone conclusion': 0,   // puts cards from draw pile to hand (separate from normal draw)
  'seeker strike': 0,         // puts cards from draw pile to hand (separate from normal draw)
  // Necrobinder
  "neow's fury": 0,           // uses discard pile, no draw
  "pact's end": 0,            // exhausts discard, no draw
  'make it so': 0,            // complex effect, no direct draw
  'catastrophe': 0,           // AoE + card effect, no draw
  'metamorphosis': 0,         // transforms cards, no standard draw
  // Generic conditional-draw cards that the codex marks as draw but are passive/conditional
  // (these trigger on other events, not when played)
  'vicious': 0,               // conditional draw on kill, not on play
  'pale blue dot': 0,         // passive effect, not on-play draw
}

function inferCardSemantics(card: GameCard, codexCard: CodexCard | undefined): ActionSemantics {
  const description = `${card.description ?? ''} ${codexCard?.description ?? ''}`.toLowerCase()
  const powers = codexCard?.powers_applied ?? []
  // Strip trailing '+' so upgraded cards (e.g. 'Catalyst+') match the same as base versions
  const cardNameLower = card.name.toLowerCase().replace(/\+$/, '')

  // Use draw override if present; otherwise use codex value (which conflates token generation with draw)
  const drawCount = cardNameLower in CARD_DRAW_OVERRIDES
    ? CARD_DRAW_OVERRIDES[cardNameLower]
    : (codexCard?.cards_draw ?? 0)

  const baseSemantics = {
    damage: codexCard?.damage ?? 0,
    hitCount: codexCard?.hit_count ?? 1,
    block: codexCard?.block ?? 0,
    draw: drawCount,
    energy: codexCard?.energy_gain ?? 0,
    heal: description.includes('heal') || description.includes('restore') ? extractFirstNumber(description) : 0,
    applyStrength: powers.find(power => power.power.toLowerCase().includes('strength'))?.amount ?? 0,
    applyFocus: powers.find(power => power.power.toLowerCase().includes('focus'))?.amount ?? 0,
    applyWeak: powers.find(power => power.power.toLowerCase().includes('weak'))?.amount ?? 0,
    applyVulnerable: powers.find(power => power.power.toLowerCase().includes('vulnerable'))?.amount ?? 0,
    applyPoison: powers.find(power => power.power.toLowerCase().includes('poison'))?.amount ?? 0,
    targetsAllEnemies: card.target_type === 'AllEnemy' || codexCard?.target === 'AllEnemy' || description.includes('all enemies'),
    targetSelf: card.target_type === 'Self' || codexCard?.target === 'Self',
    tags: [] as string[],
    isAttack: (codexCard?.type ?? card.type) === 'Attack',
    isCatalyst: cardNameLower === 'catalyst',
  }

  baseSemantics.tags = inferCardTags(card, codexCard, baseSemantics)
  return baseSemantics
}

function buildInitialPlannerState(player: PlayerState, enemies: Enemy[]): PlannerState {
  const playerStatus = player.status ?? []
  const playerFrail = playerStatus.some(p => p.id?.toLowerCase().includes('frail') && (p.amount ?? 0) > 0)
  const playerWeak = playerStatus.some(p => p.id?.toLowerCase().includes('weak') && (p.amount ?? 0) > 0)
  const playerNoDraw = playerStatus.some(p =>
    p.id?.toLowerCase().includes('no draw') || p.id?.toLowerCase().includes('no_draw') ||
    p.name?.toLowerCase().includes('no draw')
  )
  const playerIntangible = playerStatus.some(p =>
    p.id?.toLowerCase().includes('intangible') && (p.amount ?? 0) > 0
  )

  return {
    player: {
      hp: player.hp,
      max_hp: player.max_hp,
      block: player.block,
      energy: player.energy,
      // Strength/Dexterity/Focus may be in status (transient) or powers (persistent) — take the max
      strength: Math.max(getPowerAmount(player.status, 'strength'), getPowerAmount(player.powers, 'strength')),
      dexterity: Math.max(getPowerAmount(player.status, 'dexterity'), getPowerAmount(player.powers, 'dexterity')),
      focus: Math.max(getPowerAmount(player.status, 'focus'), getPowerAmount(player.powers, 'focus')),
      stars: player.stars ?? 0,
    },
    enemies: enemies.map(enemy => {
      const parsedIntent = enemy.intents?.[0] ? parseIntentDamage(enemy.intents[0]) ?? { damage: 0, times: 0 } : { damage: 0, times: 0 }
      return {
        name: enemy.name,
        hp: enemy.hp,
        block: enemy.block,
        intentDamage: parsedIntent.damage,
        intentHits: parsedIntent.times,
        weak: getEnemyPowerAmount(enemy, 'weak'),
        vulnerable: getEnemyPowerAmount(enemy, 'vulnerable'),
        poison: getEnemyPowerAmount(enemy, 'poison'),
        weakenedThisTurn: false,
        vulnerableThisTurn: false,
        thorns: getEnemyPowerAmount(enemy, 'thorns'),
        metallicize: getEnemyPowerAmount(enemy, 'metallicize'),
        regeneration: getEnemyPowerAmount(enemy, 'regen'),
      }
    }),
    remainingCards: [...(player.hand ?? [])],
    drawPile: [...(player.draw_pile ?? [])],
    remainingPotions: [...(player.potions ?? [])],
    steps: [],
    usedAllEnergy: false,
    attackCount: 0,
    skillCount: 0,
    damageDealt: 0,
    tagCounts: {},
    setupBeforeAttack: 0,
    poisonApplied: 0,
    relicBonus: 0,
    drawValue: 0,
    score: 0,
    corruptionActive: false,
    totalPoison: 0,
    playerFrail,
    playerWeak,
    playerNoDraw,
    playerIntangible,
    thornsDamageTaken: 0,
  }
}

function addTagCounts(existing: Record<string, number>, tags: string[]): Record<string, number> {
  const next = { ...existing }
  for (const tag of tags) {
    next[tag] = (next[tag] ?? 0) + 1
  }
  return next
}

function applyDamage(enemy: PlannerEnemyState, rawDamage: number, hitCount: number, player: PlannerPlayerState, isAttack = true): { enemy: PlannerEnemyState; damageDealt: number } {
  let damageDealt = 0
  const nextEnemy = { ...enemy }
  for (let hit = 0; hit < hitCount; hit += 1) {
    // Strength only boosts Attack damage, not Skill damage
    let hitDamage = Math.max(0, rawDamage + (isAttack ? player.strength : 0))
    if (nextEnemy.vulnerable > 0) hitDamage = Math.floor(hitDamage * 1.5)
    const absorbed = Math.min(nextEnemy.block, hitDamage)
    nextEnemy.block -= absorbed
    const hpDamage = Math.max(0, hitDamage - absorbed)
    nextEnemy.hp = Math.max(0, nextEnemy.hp - hpDamage)
    damageDealt += hpDamage + absorbed
  }
  return { enemy: nextEnemy, damageDealt }
}

function estimateRawIncomingDamage(state: PlannerState): number {
  return state.enemies.reduce((sum, enemy) => {
    if (enemy.hp <= 0) return sum
    let intentDamage = enemy.intentDamage
    if (enemy.weak > 0 || enemy.weakenedThisTurn) intentDamage = Math.floor(intentDamage * 0.75)
    return sum + (intentDamage * enemy.intentHits)
  }, 0)
}

function estimateIncomingDamage(state: PlannerState): number {
  return Math.max(0, estimateRawIncomingDamage(state) - state.player.block)
}

function getActionTargetCount(action: PlannerAction, enemies: PlannerEnemyState[]): number {
  if (action.semantics.targetsAllEnemies || action.semantics.targetSelf) return 1
  return enemies.filter(enemy => enemy.hp > 0).length
}

function buildAvailableActions(state: PlannerState, codex: CodexData): PlannerAction[] {
  const actions: PlannerAction[] = []
  const firstLivingEnemyIndex = state.enemies.findIndex(enemy => enemy.hp > 0)

  for (const card of state.remainingCards) {
    if (card.can_play === false) continue
    const codexCard = lookupCard(codex, card.id, card.name)
    const semantics = inferCardSemantics(card, codexCard)

    // X-cost cards spend all remaining energy (e.g. Whirlwind, Shiv Attack)
    const isXCost = card.cost === 'X' || card.cost === 'x'
    let cost = isXCost ? state.player.energy : cardCost(card)
    // Corruption: all skills cost 0 after it's been played
    if (state.corruptionActive && (codexCard?.type === 'Skill' || card.type === 'Skill')) {
      cost = 0
    }

    if (cost > state.player.energy) continue

    const targetCount = getActionTargetCount({
      id: card.id ?? card.name,
      type: 'card',
      label: card.name,
      card,
      codexCard,
      cost,
      semantics,
    }, state.enemies)

    if (targetCount <= 1) {
      actions.push({
        id: `${card.id ?? card.name}:self`,
        type: 'card',
        label: card.name,
        targetIndex: semantics.targetsAllEnemies || semantics.targetSelf ? undefined : firstLivingEnemyIndex >= 0 ? firstLivingEnemyIndex : undefined,
        card,
        codexCard,
        cost,
        semantics,
      })
      continue
    }

    state.enemies.forEach((enemy, index) => {
      if (enemy.hp <= 0) return
      actions.push({
        id: `${card.id ?? card.name}:${index}`,
        type: 'card',
        label: card.name,
        targetIndex: index,
        card,
        codexCard,
        cost,
        semantics,
      })
    })
  }

  for (const potion of state.remainingPotions) {
    const codexPotion = codex.potionById.get(potion.id)
    const semantics = inferPotionSemantics(potion, codexPotion)
    const targetCount = getActionTargetCount({
      id: potion.id,
      type: 'potion',
      label: potion.name,
      potion,
      codexPotion,
      cost: 0,
      semantics,
    }, state.enemies)

    if (targetCount <= 1) {
      actions.push({
        id: `${potion.id}:self`,
        type: 'potion',
        label: potion.name,
        targetIndex: semantics.targetsAllEnemies || semantics.targetSelf ? undefined : firstLivingEnemyIndex >= 0 ? firstLivingEnemyIndex : undefined,
        potion,
        codexPotion,
        cost: 0,
        semantics,
      })
      continue
    }

    state.enemies.forEach((enemy, index) => {
      if (enemy.hp <= 0) return
      actions.push({
        id: `${potion.id}:${index}`,
        type: 'potion',
        label: potion.name,
        targetIndex: index,
        potion,
        codexPotion,
        cost: 0,
        semantics,
      })
    })
  }

  return actions
}

function estimateRelicBonus(relics: GameRelic[], nextState: PlannerState, player: PlayerState, round: number): number {
  let bonus = 0
  for (const relic of relics) {
    const relicNameLower = relic.name.toLowerCase()
    // Pen Nib: check counter mod 10 (fires on 10th, 20th attack)
    if (relicNameLower.includes('pen nib')) {
      const counter = relic.counter ?? 0
      if (counter % 10 >= 9 && nextState.attackCount >= 1) { bonus += 10; continue }
    }
    for (const rule of RELIC_BONUS_RULES) {
      if (relicNameLower.includes(rule.nameFragment) && rule.nameFragment !== 'pen nib') {
        bonus += rule.score(nextState, player, round)
      }
    }
  }
  return bonus
}

function applyAction(state: PlannerState, action: PlannerAction, relics: GameRelic[], round: number, player: PlayerState): PlannerState {
  const baseRemainingCards = action.card ? state.remainingCards.filter(card => card !== action.card) : [...state.remainingCards]
  const nextDrawPile = [...state.drawPile]

  // Simulate draw effects: pull cards from draw_pile into hand
  const drawCount = action.semantics.draw ?? 0
  if (drawCount > 0 && nextDrawPile.length > 0) {
    const drawn = nextDrawPile.splice(0, Math.min(drawCount, nextDrawPile.length))
    baseRemainingCards.push(...drawn)
  }

  const nextState: PlannerState = {
    ...state,
    player: { ...state.player },
    enemies: state.enemies.map(enemy => ({ ...enemy })),
    remainingCards: baseRemainingCards,
    drawPile: nextDrawPile,
    remainingPotions: action.potion ? state.remainingPotions.filter(potion => potion !== action.potion) : [...state.remainingPotions],
    steps: [...state.steps],
    tagCounts: addTagCounts(state.tagCounts, action.semantics.tags),
    corruptionActive: state.corruptionActive,
    totalPoison: state.totalPoison,
  }

  // Track Corruption being played
  if (action.card && action.card.name.toLowerCase().replace(/\+$/, '') === 'corruption') {
    nextState.corruptionActive = true
  }

  nextState.player.energy = Math.max(0, nextState.player.energy - action.cost + action.semantics.energy)

  // Block: only apply when the card actually generates block (Dexterity adds to block generation).
  // Frail reduces block by 25%. Applied once here — do NOT apply again at targetSelf check below.
  if (action.semantics.block > 0) {
    const rawBlock = action.semantics.block + nextState.player.dexterity
    nextState.player.block += nextState.playerFrail
      ? Math.floor(rawBlock * 0.75)
      : rawBlock
  }

  // B1: heal is capped at max_hp, not a self-min no-op
  if (action.semantics.heal > 0) {
    nextState.player.hp = Math.min(nextState.player.max_hp, nextState.player.hp + action.semantics.heal)
  }
  nextState.player.strength += action.semantics.applyStrength
  nextState.player.focus += action.semantics.applyFocus
  nextState.drawValue += drawCount
  nextState.usedAllEnergy = nextState.player.energy === 0

  const targetIndices = action.semantics.targetsAllEnemies
    ? nextState.enemies.map((_, index) => index)
    : typeof action.targetIndex === 'number'
      ? [action.targetIndex]
      : []

  for (const targetIndex of targetIndices) {
    const targetEnemy = nextState.enemies[targetIndex]
    if (!targetEnemy || targetEnemy.hp <= 0) continue
    if (action.semantics.damage > 0) {
      // B3: apply Vulnerable bonus when enemy IS vulnerable (has stacks or was applied this turn)
      let effectiveDamage = action.semantics.damage
      // Weak (player): only reduces Attack damage, not Skill damage
      if (nextState.playerWeak && action.semantics.isAttack) effectiveDamage = Math.floor(effectiveDamage * 0.75)
      if (targetEnemy.vulnerable > 0 || targetEnemy.vulnerableThisTurn) {
        effectiveDamage = Math.floor(effectiveDamage * 1.5)
      }
      const result = applyDamage(targetEnemy, effectiveDamage, action.semantics.hitCount, nextState.player, action.semantics.isAttack)
      nextState.enemies[targetIndex] = result.enemy
      nextState.damageDealt += result.damageDealt

      // Thorns: enemy deals thorns damage back for each hit that lands
      if (targetEnemy.thorns > 0 && !nextState.playerIntangible) {
        nextState.thornsDamageTaken += targetEnemy.thorns * action.semantics.hitCount
      }
    }
    // B4: track weak/vulnerable per-enemy, not as global flags
    if (action.semantics.applyWeak > 0) {
      nextState.enemies[targetIndex].weak += action.semantics.applyWeak
      nextState.enemies[targetIndex].weakenedThisTurn = true
    }
    if (action.semantics.applyVulnerable > 0) {
      nextState.enemies[targetIndex].vulnerable += action.semantics.applyVulnerable
      nextState.enemies[targetIndex].vulnerableThisTurn = true
    }
    if (action.semantics.applyPoison > 0) {
      nextState.enemies[targetIndex].poison += action.semantics.applyPoison
      nextState.poisonApplied += action.semantics.applyPoison
      nextState.totalPoison += action.semantics.applyPoison
    }
  }

  // B2: Catalyst doubles all poison on target enemies.
  // Only update totalPoison by the *added* amount (poison doubled, so add the existing amount once more).
  if (action.semantics.isCatalyst) {
    for (const targetIndex of targetIndices) {
      const targetEnemy = nextState.enemies[targetIndex]
      if (!targetEnemy || targetEnemy.hp <= 0) continue
      // enemy.poison is the pre-double value; add it once more to represent the doubling delta
      nextState.totalPoison += targetEnemy.poison
      nextState.enemies[targetIndex] = { ...targetEnemy, poison: targetEnemy.poison * 2 }
    }
  }

  if (action.semantics.isAttack) {
    nextState.attackCount += 1
    if ((nextState.tagCounts.setup ?? 0) > 0) nextState.setupBeforeAttack += 1
  } else {
    nextState.skillCount += 1
  }

  nextState.relicBonus = estimateRelicBonus(relics, nextState, player, round)

  nextState.steps.push({
    type: action.type,
    label: action.label,
    reason: buildActionReason(action),
    priority: nextState.steps.length,
    card: action.card,
    targetEnemyName: typeof action.targetIndex === 'number' ? nextState.enemies[action.targetIndex]?.name : undefined,
    potionName: action.potion?.name,
  })

  return nextState
}

function buildActionReason(action: PlannerAction): string {
  const notes: string[] = []
  if (action.semantics.damage > 0) {
    const totalDamage = action.semantics.damage * Math.max(1, action.semantics.hitCount)
    notes.push(`${totalDamage} damage`)
  }
  if (action.semantics.block > 0) notes.push(`${action.semantics.block} block`)
  if (action.semantics.applyPoison > 0) notes.push(`${action.semantics.applyPoison} poison`)
  if (action.semantics.isCatalyst) notes.push('doubles poison')
  if (action.semantics.applyVulnerable > 0) notes.push(`${action.semantics.applyVulnerable} vulnerable`)
  if (action.semantics.applyWeak > 0) notes.push(`${action.semantics.applyWeak} weak`)
  if (action.semantics.applyStrength > 0) notes.push(`+${action.semantics.applyStrength} strength`)
  if (action.semantics.draw > 0) notes.push(`draw ${action.semantics.draw}`)
  if (notes.length === 0 && action.type === 'potion') notes.push('combat potion line')
  return notes.join(', ')
}

function evaluateState(
  state: PlannerState,
  buildId: CombatBuildLensId,
  currentTurn: CombatTurn,
  nextTurnPreview: CombatTurn | null,
): number {
  const profile = getCombatBuildProfile(buildId)
  const remainingEnemyHp = state.enemies.reduce((sum, enemy) => sum + Math.max(0, enemy.hp), 0)
  const incomingDamage = estimateIncomingDamage(state)
  const survivesIncoming = incomingDamage < state.player.hp
  const lethalNow = remainingEnemyHp === 0

  // Poison next-turn value: each poison stack deals 1 damage, ticking down each turn
  const poisonNextTurnValue = state.totalPoison * 8

  const nextTurnSetup = poisonNextTurnValue
    + state.drawValue * 1.2
    + state.player.strength * 1.4
    + state.player.focus * 1.4
    + state.player.stars * 0.8
    + (nextTurnPreview?.totalDamage ?? 0) * (state.player.block > incomingDamage ? 0.15 : 0)

  let buildBonus = 0
  for (const [tag, count] of Object.entries(state.tagCounts)) {
    buildBonus += (profile.tagWeights[tag] ?? 0) * count
  }

  const primaryBuildTag = PRIMARY_BUILD_TAG[buildId]
  const buildFocusCount = primaryBuildTag ? (state.tagCounts[primaryBuildTag] ?? 0) : 0

  const incomingTotal = estimateRawIncomingDamage(state)    // pre-block raw damage

  // ── Tier 1: Lethal / survival (dominates all other scoring) ─────────────
  let score = 0
  if (lethalNow) score += 100_000
  if (currentTurn.isLethal && survivesIncoming) score += 35_000
  if (!survivesIncoming) score -= 40_000 + incomingDamage * 120
  if (survivesIncoming) score += 15_000

  // ── Tier 2: Per-point scoring ────────────────────────────────────────────

  score += state.damageDealt * 18
  score -= remainingEnemyHp * 8

  // Block efficiency: useful block (absorbs real damage) vs. surplus (overkill)
  const usefulBlock = Math.min(state.player.block, incomingTotal)
  const surplusBlock = Math.max(0, state.player.block - incomingTotal)
  score += usefulBlock * 14   // efficiently absorbs incoming damage
  score += surplusBlock * 3   // surplus has carry-over value but is largely wasted this turn

  // Thorns self-damage: penalise plans that cause excessive Thorns blowback
  if (state.thornsDamageTaken > 0) {
    score -= state.thornsDamageTaken * 10
  }

  // Regeneration: penalise leaving enemies alive when they regen HP (lost damage)
  for (const enemy of state.enemies) {
    if (enemy.hp > 0 && enemy.regeneration > 0) {
      score -= enemy.regeneration * 12  // each regen tick is effectively wasted damage
    }
  }

  // HP efficiency: reward healthy aggression — dealing damage while staying safe
  const hpAfterTurn = state.player.hp - incomingDamage
  const hpRatio = state.player.max_hp > 0 ? hpAfterTurn / state.player.max_hp : 0
  if (survivesIncoming && state.damageDealt > 0) {
    if (hpRatio > 0.7) score += state.damageDealt * 4    // aggressive and safe
    else if (hpRatio > 0.4) score += state.damageDealt * 1  // risky but surviving
  }

  score += nextTurnSetup * 14
  score += buildBonus * 18

  // Setup-before-attack: stronger reward (24 vs old 12) + combo bonus for Vulnerable+attack
  score += state.setupBeforeAttack * 24
  const vulnerableAndAttacked = state.damageDealt > 0
    && state.enemies.some(e => e.hp > 0 && (e.vulnerable > 0 || e.vulnerableThisTurn))
  if (vulnerableAndAttacked) score += state.damageDealt * 4

  // Ordering bonus: draw-first pays off when we drew cards that got played
  // (drawValue > 0 and we attacked after — the cards were useful)
  if (state.drawValue > 0 && state.attackCount > 0) {
    score += state.drawValue * 500   // significant bonus for drawing before attacking
  }

  // Strength-before-attack: bonus when strength was applied and attacks followed
  const strengthApplied = (state.tagCounts.strength ?? 0) > 0
  if (strengthApplied && state.attackCount > 0 && state.player.strength > 0) {
    score += state.player.strength * state.attackCount * 300
  }

  // Catalyst-after-poison: bonus for playing Catalyst after stacking poison
  // Only fires when Catalyst itself was played (isCatalyst flag in semantics)
  // We detect this by checking if any step has 'doubles poison' in its reason
  const catalystWasPlayed = state.steps.some(step => step.reason?.includes('doubles poison'))
  if (catalystWasPlayed && state.totalPoison > 0) {
    score += state.totalPoison * 200
  }

  score += state.relicBonus * 10

  // Per-enemy debuff scaling: value scales with enemy HP (Vulnerable) and damage output (Weak)
  let debuffScore = 0
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue
    if (enemy.vulnerable > 0 || enemy.vulnerableThisTurn) {
      // ~50% future damage bonus on this enemy (cap at 50 HP to avoid end-of-fight overvaluation)
      debuffScore += Math.min(enemy.hp, 50) * 0.5 * 8
    }
    if (enemy.weak > 0 || enemy.weakenedThisTurn) {
      // 25% reduction on enemy outgoing damage — scales with how hard they hit
      debuffScore += (enemy.intentDamage * enemy.intentHits) * 0.25 * 10
    }
    // Metallicize penalty: scoring the enemy getting harder to kill next turn
    if (enemy.metallicize > 0) {
      debuffScore -= enemy.metallicize * 5
    }
  }
  score += debuffScore

  if (buildId !== 'auto' && primaryBuildTag) {
    score += buildFocusCount > 0 ? buildFocusCount * 700 : -220
  }

  // Energy efficiency: penalize wasted energy meaningfully (was: usedAllEnergy ? 4 : 0)
  const energyWasted = state.player.energy
  if (!currentTurn.isLethal && energyWasted > 0) {
    if (energyWasted >= 2) score -= energyWasted * 200   // -400 for 2 wasted, -600 for 3
    else score -= 50                                       // -50 for 1 leftover (may be unavoidable)
  }

  return score
}

function stateToCandidateLine(
  state: PlannerState,
  buildId: CombatBuildLensId,
  currentTurn: CombatTurn,
): CombatCandidateLine {
  const remainingEnemyHp = state.enemies.reduce((sum, enemy) => sum + Math.max(0, enemy.hp), 0)
  const netIncomingDamage = estimateIncomingDamage(state)
  const lethalNow = remainingEnemyHp === 0
  const survivesIncoming = netIncomingDamage < state.player.hp
  const suggestedPlay: PlaySuggestion[] = state.steps
    .filter(step => step.type === 'card' && step.card)
    .map((step, index) => {
      const prefix = lethalNow && index === 0
        ? 'Lethal line'
        : currentTurn.isLethal && survivesIncoming && index === 0
          ? 'Survive first'
          : `Step ${index + 1}`
      return {
        card: step.card!,
        reason: `${prefix}: ${step.reason || step.label}`,
        priority: index,
      }
    })

  let summary = `Balanced line deals ${state.damageDealt} and leaves ${netIncomingDamage} incoming damage.`
  if (lethalNow) {
    summary = `Lethal line found with ${state.steps.map(step => step.label).join(' -> ')}.`
  } else if (currentTurn.isLethal && survivesIncoming) {
    summary = `Survive this turn with ${state.steps.map(step => step.label).join(' -> ')}.`
  } else if (!survivesIncoming) {
    summary = `Best ${buildId === 'auto' ? 'balanced' : buildId} line still takes ${netIncomingDamage} damage.`
  } else if (state.totalPoison > 0) {
    summary = `${state.damageDealt} damage dealt + ${state.totalPoison} poison ticking. ${netIncomingDamage} incoming.`
  }

  const potionStep = state.steps.find(step => step.type === 'potion')

  return {
    id: state.steps.map(step => `${step.type}:${step.label}:${step.targetEnemyName ?? 'na'}`).join('|') || 'end-turn',
    summary,
    score: state.score,
    netIncomingDamage,
    estimatedEnemyDamage: state.damageDealt,
    estimatedBlock: state.player.block,
    lethalNow,
    survivesIncoming,
    steps: state.steps.length > 0 ? state.steps : [{
      type: 'end-turn',
      label: 'End Turn',
      reason: 'No strong action line available',
      priority: 0,
    }],
    suggestedPlay,
    potionSuggestion: potionStep ? `Use ${potionStep.potionName ?? potionStep.label} in this line.` : undefined,
  }
}

function pickTopDistinctStates(states: PlannerState[], limit: number): PlannerState[] {
  const distinct = new Map<string, PlannerState>()
  for (const state of states.sort((a, b) => b.score - a.score)) {
    const key = state.steps.map(step => `${step.type}:${step.label}:${step.targetEnemyName ?? 'na'}`).join('|') || 'end-turn'
    if (!distinct.has(key)) distinct.set(key, state)
    if (distinct.size >= limit) break
  }
  return [...distinct.values()]
}

export function planCombatAdvice(
  gameState: GameState,
  codex: CodexData,
  currentTurn: CombatTurn,
  nextTurnPreview: CombatTurn | null,
  archetype: DeckArchetype | undefined,
  options: PlannerOptions,
): Pick<
  CombatAdvice,
  | 'combatKey'
  | 'characterId'
  | 'candidateLines'
  | 'availableBuildLenses'
  | 'selectedBuildLensId'
  | 'selectedBuildLensLabel'
  | 'autoBuildLensId'
  | 'autoBuildLensLabel'
  | 'suggestedPlay'
  | 'potionSuggestion'
  | 'summary'
> {
  const player = gameState.player!
  const enemies = gameState.battle!.enemies ?? []
  const characterId = normalizeCharacterId(player.character)
  const availableBuildLenses = getCombatBuildOptions(characterId)
  const autoBuildLensId = resolveAutoBuildLens(characterId, archetype, player)
  const autoBuildLensLabel = availableBuildLenses.find(option => option.id === autoBuildLensId)?.label ?? 'Auto'
  const activeBuildId = options.selectedBuildLensId === 'auto' ? autoBuildLensId : options.selectedBuildLensId
  const selectedBuildLensLabel = availableBuildLenses.find(option => option.id === options.selectedBuildLensId)?.label ?? 'Auto'
  const combatKey = `${characterId}:${gameState.run?.act ?? 0}:${gameState.run?.floor ?? 0}:${gameState.battle?.round ?? 0}:${enemies.map(enemy => enemy.combat_id).join(',')}`
  const round = gameState.battle?.round ?? 1

  const initialState = buildInitialPlannerState(player, enemies)
  let beam: PlannerState[] = [initialState]
  const evaluated: PlannerState[] = []
  let evaluations = 0

  for (let depth = 0; depth < MAX_ACTION_DEPTH; depth += 1) {
    const nextBeam: PlannerState[] = []
    for (const state of beam) {
      const actions = buildAvailableActions(state, codex)
      if (actions.length === 0) {
        state.score = evaluateState(state, activeBuildId, currentTurn, nextTurnPreview)
        evaluated.push(state)
        continue
      }

      for (const action of actions) {
        const applied = applyAction(state, action, player.relics, round, player)
        applied.score = evaluateState(applied, activeBuildId, currentTurn, nextTurnPreview)
        nextBeam.push(applied)
        evaluated.push(applied)
        evaluations += 1
        if (evaluations >= MAX_EVALUATED_STATES) break
      }

      if (evaluations >= MAX_EVALUATED_STATES) break
    }

    if (evaluations >= MAX_EVALUATED_STATES || nextBeam.length === 0) break
    nextBeam.sort((a, b) => b.score - a.score)
    beam = nextBeam.slice(0, MAX_BEAM_WIDTH)
  }

  const terminalStates = pickTopDistinctStates([...evaluated, ...beam], 3)
  const candidateLines = terminalStates.length > 0
    ? terminalStates.map(state => stateToCandidateLine(state, activeBuildId, currentTurn))
    : [stateToCandidateLine(initialState, activeBuildId, currentTurn)]

  return {
    combatKey,
    characterId,
    candidateLines,
    availableBuildLenses,
    selectedBuildLensId: options.selectedBuildLensId,
    selectedBuildLensLabel,
    autoBuildLensId,
    autoBuildLensLabel,
    suggestedPlay: candidateLines[0]?.suggestedPlay ?? [],
    potionSuggestion: candidateLines[0]?.potionSuggestion,
    summary: candidateLines[0]?.summary ?? 'No combat line available.',
  }
}
