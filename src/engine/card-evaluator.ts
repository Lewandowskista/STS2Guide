import type { GameCard, GameRelic, ActivePower } from '@/types/game-state'
import type { CodexData } from '@/types/codex'
import { lookupCard } from '@/types/codex'
import type { CardEvaluation, DeckArchetype } from '@/types/advisor'
import { scoreToRating } from '@/types/advisor'
import { evaluateCardSynergies } from './synergy-engine'
import { buildTargetBonus } from './meta-builds'
import type { BuildTarget } from './meta-builds'
import { CARD_DECK_SIZE_PENALTY_THRESHOLD } from './constants'

const RARITY_BASE: Record<string, number> = {
  Starter: 3,
  Basic: 3,
  Common: 4,
  Uncommon: 5.5,
  Rare: 7,
  Special: 6,
}

const TYPE_PENALTY: Record<string, number> = {
  Curse: -3,
  Status: -2,
}

function cx(card: GameCard, codex: CodexData) {
  return lookupCard(codex, card.id, card.name)
}

function archFit(card: GameCard, codex: CodexData, archetype: DeckArchetype): { bonus: number; reason: string | null } {
  const c = cx(card, codex)

  // Use inline card data as fallback when codex entry is missing
  const cardType = c?.type ?? card.type ?? ''
  const cardName = (c?.name ?? card.name ?? '').toLowerCase()
  const cardDesc = (c?.description ?? card.description ?? '').toLowerCase()
  const codexKws = c?.keywords?.map(k => k.toLowerCase()) ?? []
  const apiKws = card.keywords?.map(k => k.name.toLowerCase()) ?? []
  const allKws = [...codexKws, ...apiKws]

  const archetypeKeywords: Partial<Record<string, string[]>> = {
    'strength-scaling': ['strength', 'flex', 'inflame', 'limit break', 'spot weakness', 'heavy blade'],
    'block-turtle': ['barricade', 'body slam', 'entrench', 'impervious', 'fortress', 'iron wave', 'metallicize'],
    'draw-engine': ['draw', 'adrenaline', 'acrobatics', 'expertise', 'streamline', 'bullet time'],
    'exhaust': ['exhaust', 'feel no pain', 'dark embrace', 'corruption', 'sentinel'],
    'orb-focus': ['channel', 'evoke', 'orb', 'lightning', 'frost', 'dark', 'plasma', 'consume', 'defragment'],
    'poison': ['poison', 'catalyst', 'noxious', 'corpse explosion', 'deadly poison', 'bouncing flask'],
    'shiv': ['shiv', 'blade dance', 'thousand cuts', 'accuracy', 'hand of greed', 'cloak and dagger'],
    'discard': ['discard', 'reflex', 'tactician', 'wraith form', 'calculated gamble'],
    'powers-heavy': [],
    'pet-synergy': ['pet', 'companion', 'bond', 'summon'],
    'star-engine': ['star', 'windmill strike', 'eruption', 'reach heaven'],
  }

  const archetypeLabels: Partial<Record<string, string>> = {
    'strength-scaling': 'Strength build',
    'block-turtle': 'Block/Turtle build',
    'draw-engine': 'Draw Engine build',
    'exhaust': 'Exhaust build',
    'orb-focus': 'Orb/Defect build',
    'poison': 'Poison build',
    'shiv': 'Shiv build',
    'discard': 'Discard build',
    'powers-heavy': 'Powers build',
    'pet-synergy': 'Pet build',
    'star-engine': 'Star Engine build',
  }

  const keywords = archetypeKeywords[archetype.primary] ?? []
  const matchedKw = keywords.find(k =>
    cardName.includes(k) || cardDesc.includes(k) || allKws.some(ck => ck.includes(k))
  )

  if (archetype.primary === 'powers-heavy' && cardType === 'Power') {
    return { bonus: 1.5 * archetype.confidence, reason: `Power card — fits ${archetypeLabels['powers-heavy']}` }
  }
  // AoE cards get extra bonus if archetype needs damage spread
  if (card.target_type === 'AllEnemy' && ['strength-scaling', 'orb-focus'].includes(archetype.primary)) {
    return { bonus: 1.0, reason: `AoE — good for ${archetypeLabels[archetype.primary] ?? archetype.label}` }
  }
  if (matchedKw) {
    return {
      bonus: 1.5 * archetype.confidence,
      reason: `Fits ${archetypeLabels[archetype.primary] ?? archetype.label} (${matchedKw})`,
    }
  }
  return { bonus: 0, reason: null }
}

function deckNeed(card: GameCard, codex: CodexData, deck: GameCard[]): number {
  const c = cx(card, codex)
  if (!c) return 0

  const codexDeck = deck.map(d => cx(d, codex)).filter(Boolean)
  const attackCount = codexDeck.filter(d => d?.type === 'Attack').length
  const skillCount = codexDeck.filter(d => d?.type === 'Skill').length
  const hasAoe = codexDeck.some(d => (d?.hit_count ?? 1) > 1 || d?.description?.toLowerCase().includes('all enemies'))
  const hasDraw = codexDeck.some(d => (d?.cards_draw ?? 0) > 0)
  const hasScaling = codexDeck.some(d =>
    d?.powers_applied?.some(p => ['strength', 'dexterity'].some(pw => p.power.toLowerCase().includes(pw)))
  )

  let bonus = 0
  if (!hasAoe && c.description?.toLowerCase().includes('all enemies')) bonus += 1.5
  if (!hasDraw && (c.cards_draw ?? 0) > 0) bonus += 1.5
  if (!hasScaling && c.powers_applied?.some(p => ['strength', 'dexterity'].some(pw => p.power.toLowerCase().includes(pw)))) bonus += 1.5
  if (attackCount < 4 && c.type === 'Attack') bonus += 0.5
  if (skillCount < 4 && c.type === 'Skill') bonus += 0.5

  return bonus
}

/** Detect if adding this card creates a redundant role in the deck */
function redundancyCheck(card: GameCard, codex: CodexData, deck: GameCard[], archetype: DeckArchetype): string | null {
  const c = cx(card, codex)
  if (!c) return null

  const codexDeck = deck.map(d => cx(d, codex)).filter(Boolean)

  // Count draw cards
  if ((c.cards_draw ?? 0) > 0) {
    const drawCount = codexDeck.filter(d => (d?.cards_draw ?? 0) > 0).length
    if (drawCount >= 3) return `Already have ${drawCount} draw cards — diminishing returns`
  }

  // Count AoE cards
  if (c.description?.toLowerCase().includes('all enemies') || (c.hit_count ?? 1) > 2) {
    const aoeCount = codexDeck.filter(d =>
      d?.description?.toLowerCase().includes('all enemies') || (d?.hit_count ?? 1) > 2
    ).length
    if (aoeCount >= 3) return `Already have ${aoeCount} AoE cards`
  }

  // Count scaling sources (Strength/Dexterity)
  if (c.powers_applied?.some(p => ['strength', 'dexterity'].some(pw => p.power.toLowerCase().includes(pw)))) {
    const scalingCount = codexDeck.filter(d =>
      d?.powers_applied?.some(p => ['strength', 'dexterity'].some(pw => p.power.toLowerCase().includes(pw)))
    ).length
    if (scalingCount >= 3) return `Already have ${scalingCount} scaling sources`
  }

  // Starter/basic redundancy
  if (c.rarity === 'Starter' || c.rarity === 'Basic') {
    const starterCount = codexDeck.filter(d => d?.rarity === 'Starter' || d?.rarity === 'Basic').length
    if (starterCount >= 4) return 'Too many starter/basic cards — consider removal instead'
  }

  // Poison redundancy for non-poison builds
  if (c.description?.toLowerCase().includes('poison') && archetype.primary !== 'poison' && archetype.secondary !== 'poison') {
    const poisonCount = codexDeck.filter(d => d?.description?.toLowerCase().includes('poison')).length
    if (poisonCount >= 2) return 'Poison cards without a poison build — low synergy'
  }

  return null
}

/** Detect scaling potential of a card for the late game */
function scalingNote(card: GameCard, codex: CodexData, act: number): string | null {
  const c = cx(card, codex)
  if (!c) return null

  const desc = (c.description ?? card.description ?? '').toLowerCase()
  const name = (c.name ?? card.name ?? '').toLowerCase()

  if (c.type === 'Power') return 'Power card — permanent passive for the whole fight'
  if (desc.includes('strength') && desc.includes('gain')) return 'Scales Strength — damage grows each turn'
  if (desc.includes('dexterity') && desc.includes('gain')) return 'Scales Dexterity — block grows each turn'
  if (desc.includes('poison') && desc.includes('apply') && act >= 2) return 'Stacks Poison — scales with each application'
  if (name.includes('catalyst')) return 'Doubles current Poison stack — exponential scaling'
  if (desc.includes('exhaust') && desc.includes('gain')) return 'Exhaust payoff — grows as you exhaust cards'
  if (desc.includes('whenever') || desc.includes('each time')) return 'Triggered scaling — grows with deck cycling'

  return null
}

/** Score bonus for upcoming threat (boss/elite) */
function upcomingThreatBonus(card: GameCard, codex: CodexData, upcomingThreat: 'elite' | 'boss' | 'none'): { bonus: number; note: string | null } {
  if (upcomingThreat === 'none') return { bonus: 0, note: null }

  const c = cx(card, codex)
  const desc = (c?.description ?? card.description ?? '').toLowerCase()
  const type = c?.type ?? card.type ?? ''

  // Before elites: burst damage cards and defensive tools
  if (upcomingThreat === 'elite') {
    if (type === 'Attack' && (c?.damage ?? 0) >= 12) return { bonus: 0.5, note: 'High damage — good for elite burst' }
    if (desc.includes('vulnerable')) return { bonus: 0.4, note: 'Vulnerability debuff — amplifies elite damage' }
    if (type === 'Skill' && desc.includes('block') && (c?.block ?? 0) >= 8) return { bonus: 0.4, note: 'Strong block for elite survival' }
  }

  // Before boss: scaling, sustain, and defensive tools
  if (upcomingThreat === 'boss') {
    if (type === 'Power') return { bonus: 0.8, note: 'Power card — strong sustained value for boss fight' }
    if (desc.includes('artifact')) return { bonus: 0.7, note: 'Artifact blocks debuffs — valuable vs boss debuffs' }
    if (desc.includes('all enemies') || (c?.hit_count ?? 1) > 2) return { bonus: 0.5, note: 'AoE — helps vs multi-phase or minion bosses' }
    if (type === 'Skill' && desc.includes('block') && (c?.block ?? 0) >= 10) return { bonus: 0.5, note: 'Big block for boss spike turns' }
    if (desc.includes('strength') || desc.includes('dexterity')) return { bonus: 0.4, note: 'Scaling — grows into boss fight length' }
  }

  return { bonus: 0, note: null }
}

/** Compute energy efficiency score for a card and apply a bonus/penalty */
function energyEfficiencyBonus(card: GameCard, codex: CodexData, act: number): number {
  const c = cx(card, codex)
  if (!c) return 0

  const cost = typeof card.cost === 'number' ? card.cost : parseInt(card.cost as string, 10)
  if (isNaN(cost) || cost < 0) return 0  // X-cost or unplayable — skip

  const type = c.type ?? card.type ?? ''
  const damage = c.damage ?? 0
  const hitCount = c.hit_count ?? 1
  const block = c.block ?? 0

  let efficiency = 0
  if (type === 'Attack' && damage > 0) {
    efficiency = (damage * hitCount) / Math.max(1, cost)
  } else if (type === 'Skill' && block > 0) {
    efficiency = block / Math.max(1, cost)
  } else {
    return 0  // Powers and complex effects don't have a simple efficiency metric
  }

  let bonus = 0
  const rarity = c.rarity ?? card.rarity ?? ''
  if (efficiency < 4.0 && (rarity === 'Common' || rarity === 'Uncommon') && type === 'Attack') {
    bonus = -0.3  // Low damage per energy
  } else if (efficiency > 10.0) {
    bonus = 0.3   // High damage/block per energy
  }

  // Act 1 tempo preference: cheap efficient cards get extra bonus
  if (act <= 1 && (cost === 0 || cost === 1) && efficiency > 6.0) {
    bonus += 0.3
  }

  return bonus
}

function runPhaseBonus(card: GameCard, codex: CodexData, act: number): number {
  const c = cx(card, codex)
  if (!c) return 0

  if (act <= 1) {
    if (c.damage && c.damage > 0 && (c.hit_count ?? 1) === 1) return 0.5
    if (c.type === 'Power') return -0.3
  }
  if (act >= 3) {
    if (c.type === 'Power') return 0.5
    if (c.powers_applied?.some(p => p.power.toLowerCase().includes('strength'))) return 0.5
  }
  return 0
}

export function evaluateCard(
  card: GameCard,
  deck: GameCard[],
  relics: GameRelic[],
  codex: CodexData,
  archetype: DeckArchetype,
  powers: ActivePower[],
  act: number,
  floor: number,
  character: string,
  upcomingThreat: 'elite' | 'boss' | 'none' = 'none',
  buildTargets?: BuildTarget[],
  playerStars?: number,
): CardEvaluation {
  const c = cx(card, codex)

  // Use inline API card type/rarity as fallback when codex entry is missing
  const effectiveType = c?.type ?? card.type ?? ''
  const effectiveRarity = c?.rarity ?? card.rarity ?? ''

  if (effectiveType === 'Curse' || effectiveType === 'Status') {
    const penalty = TYPE_PENALTY[effectiveType] ?? -2
    const penaltyScore = Math.max(1, 3 + penalty)
    return {
      card,
      codexCard: c ?? null,
      score: penaltyScore,
      rating: scoreToRating(penaltyScore),
      reasons: [{ type: 'type', label: 'Curse/Status', description: 'Curses and status cards are generally harmful', weight: penalty }],
    }
  }

  const baseScore = RARITY_BASE[effectiveRarity] ?? (c ? 5 : 4.5)
  const synergyReasons = evaluateCardSynergies(card, deck, codex, relics, powers, archetype, character, act, floor)
  const synergyScore = synergyReasons.reduce((sum, r) => sum + r.weight, 0)
  const { bonus: archBonus, reason: archReason } = archFit(card, codex, archetype)
  const needBonus = deckNeed(card, codex, deck)
  const phaseBonus = runPhaseBonus(card, codex, act)
  const deckSizePenalty = deck.length > CARD_DECK_SIZE_PENALTY_THRESHOLD ? -0.5 : 0
  const { bonus: threatBonus, note: threatNote } = upcomingThreatBonus(card, codex, upcomingThreat)
  const effBonus = energyEfficiencyBonus(card, codex, act)
  const { bonus: buildBonus, reason: buildReason, isCoreCard } = buildTargets && buildTargets.length > 0
    ? buildTargetBonus(card.name, buildTargets)
    : { bonus: 0, reason: null, isCoreCard: false }

  // Spawn card synergy — cards that generate other cards (Blade Dance → Shivs, etc.)
  let spawnBonus = 0
  if (c?.spawns_cards && c.spawns_cards.length > 0) {
    const spawnedNames = c.spawns_cards.map(s => s.toLowerCase())
    const hasShivSpawn = spawnedNames.some(s => s.includes('shiv'))
    const hasCurseSpawn = spawnedNames.some(s => s.includes('curse') || s.includes('wound') || s.includes('dazed') || s.includes('slime'))
    if (hasShivSpawn && archetype.primary === 'shiv') {
      spawnBonus += 0.8
    } else if (hasCurseSpawn) {
      spawnBonus -= 0.4
    }
  }

  // Stars system (Regent character) — star-cost cards scale with available stars
  let starBonus = 0
  let starNote: string | null = null
  if (c && (c.is_x_star_cost || (c.star_cost !== null && c.star_cost !== undefined && c.star_cost > 0))) {
    if (archetype.primary === 'star-engine' || archetype.secondary === 'star-engine') {
      const stars = playerStars ?? 0
      // Bonus scales from +0.5 (0 stars) to +1.2 (5+ stars)
      starBonus = Math.min(1.2, 0.5 + stars * 0.14)
      starNote = `Star-cost card — costs Stars per play (${stars} Stars available)`
    } else {
      starNote = 'Star-cost card — needs Star generation to be effective'
    }
  }

  const rawScore = baseScore + synergyScore * 2 + archBonus + needBonus + phaseBonus + deckSizePenalty + threatBonus + buildBonus + starBonus + spawnBonus + effBonus
  const score = Math.max(1, Math.min(10, rawScore))

  // Collect all reasons including build fit
  const allReasons = [...synergyReasons]
  if (buildReason && buildBonus > 0) {
    allReasons.unshift({ type: 'build-target', label: 'Build Target', description: buildReason, weight: buildBonus })
  }
  if (archReason && archBonus > 0) {
    allReasons.unshift({ type: 'archetype-fit', label: 'Build Fit', description: archReason, weight: archBonus })
  }

  // Extra annotation fields
  const redundancy = redundancyCheck(card, codex, deck, archetype)
  const scaling = scalingNote(card, codex, act)
  const threatFit = threatNote

  return {
    card,
    codexCard: c ?? null,
    score,
    rating: scoreToRating(score),
    reasons: allReasons.slice(0, 3),
    redundancyNote: redundancy ?? undefined,
    scalingNote: starNote ?? scaling ?? undefined,
    upcomingThreatFit: threatFit ?? undefined,
    isCoreCard: isCoreCard ? true : undefined,
  }
}

export function evaluateCards(
  cards: GameCard[],
  deck: GameCard[],
  relics: GameRelic[],
  codex: CodexData,
  archetype: DeckArchetype,
  powers: ActivePower[],
  act: number,
  floor: number,
  character: string,
  upcomingThreat: 'elite' | 'boss' | 'none' = 'none',
  buildTargets?: BuildTarget[],
  playerStars?: number,
): CardEvaluation[] {
  const evals = cards.map(c =>
    evaluateCard(c, deck, relics, codex, archetype, powers, act, floor, character, upcomingThreat, buildTargets, playerStars)
  )
  const bestScore = Math.max(...evals.map(e => e.score))
  if (bestScore < 5) evals.forEach(e => { e.isSkipBetter = true })
  return evals.sort((a, b) => b.score - a.score)
}
