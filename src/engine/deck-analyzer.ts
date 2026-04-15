import type { GameCard, GameRelic, ActivePower } from '@/types/game-state'
import type { CodexData } from '@/types/codex'
import { lookupCard } from '@/types/codex'
import type { DeckAnalysis, DeckWeakness, SynergyReason } from '@/types/advisor'
import { detectArchetype } from './archetype-detector'
import { buildSynergyGraph } from './synergy-engine'
import { detectBuildTargets } from './meta-builds'
import { DECK_NO_DRAW_THRESHOLD, DECK_TOO_LARGE_BY_CHARACTER, HIGH_AVG_COST_THRESHOLD } from './constants'

export function analyzeDeck(
  deck: GameCard[],
  relics: GameRelic[],
  codex: CodexData,
  powers: ActivePower[],
  character: string,
  act: number,
  floor: number,
  characterId?: string,
  potionCount?: number,
): DeckAnalysis {
  const charKey = (characterId ?? character ?? '').toLowerCase()
  const archetype = detectArchetype(deck, codex, relics, powers, characterId, floor)
  const graph = buildSynergyGraph(deck, codex, relics, powers, archetype, character, act, floor)

  // Card type breakdown
  const codexDeck = deck.map(c => lookupCard(codex, c.id, c.name)).filter(Boolean)
  const breakdown = {
    attack: codexDeck.filter(c => c?.type === 'Attack').length,
    skill: codexDeck.filter(c => c?.type === 'Skill').length,
    power: codexDeck.filter(c => c?.type === 'Power').length,
    curse: codexDeck.filter(c => c?.type === 'Curse' || c?.type === 'Status').length,
    other: 0,
  }
  breakdown.other = deck.length - breakdown.attack - breakdown.skill - breakdown.power - breakdown.curse

  // Average cost
  const costs = codexDeck.map(c => c?.cost ?? 1).filter(c => c >= 0)
  const avgCost = costs.length > 0 ? costs.reduce((s, x) => s + x, 0) / costs.length : 1

  // Weaknesses
  const weaknesses: DeckWeakness[] = []

  const hasAoe = codexDeck.some(c =>
    c?.description?.toLowerCase().includes('all enemies') || (c?.hit_count ?? 1) > 2
  )
  // Poison and shiv archetypes win through single-target damage over time — AoE isn't required
  const archPrimary = archetype?.primary
  const aoeNotNeeded = archPrimary === 'poison' || archPrimary === 'shiv' || archPrimary === 'discard'
  if (!hasAoe && deck.length > 8 && !aoeNotNeeded) {
    weaknesses.push({ type: 'no-aoe', label: 'No AoE damage', severity: 'major' })
  }

  const hasScaling = codexDeck.some(c =>
    c?.powers_applied?.some(p => ['strength', 'dexterity'].some(pw => p.power.toLowerCase().includes(pw)))
  )
  if (!hasScaling && act >= 2) {
    weaknesses.push({ type: 'no-scaling', label: 'No damage scaling', severity: 'major' })
  }

  const hasDraw = codexDeck.some(c => (c?.cards_draw ?? 0) > 0)
  if (!hasDraw && deck.length > DECK_NO_DRAW_THRESHOLD) {
    weaknesses.push({ type: 'no-draw', label: 'No card draw', severity: 'minor' })
  }

  // Per-character deck-size threshold: Defect wants a larger pool for orb generators
  const deckTooLargeThreshold = DECK_TOO_LARGE_BY_CHARACTER[charKey] ?? 30
  if (deck.length > deckTooLargeThreshold) {
    weaknesses.push({ type: 'too-large', label: `Deck too large (${deck.length} cards)`, severity: 'major' })
  }

  if (breakdown.curse > 0) {
    weaknesses.push({ type: 'curse-heavy', label: `${breakdown.curse} curse(s) in deck`, severity: breakdown.curse > 1 ? 'major' : 'minor' })
  }

  // Slow-early weakness: high average cost on a small deck means few cards can be played per turn
  if (avgCost > HIGH_AVG_COST_THRESHOLD && deck.length < 20) {
    weaknesses.push({ type: 'no-draw', label: 'High avg card cost — slow early turns', severity: 'minor' })
  }

  // Potion economy: no potions before boss is a meaningful resource gap
  const floorInAct = floor % 17
  const nearBossFloor = floorInAct >= 14 || floorInAct === 0
  if (potionCount !== undefined && potionCount === 0 && nearBossFloor) {
    weaknesses.push({ type: 'no-draw', label: 'No potions before boss', severity: 'minor' })
  }

  // Key synergies from graph
  const topEdges = graph.edges
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
  const keySynergies: SynergyReason[] = topEdges.map(e => ({
    type: e.type,
    label: e.label,
    description: e.description,
    weight: e.weight,
  }))

  // Power level: composite 1-10 based on synergy strength, weaknesses, archetype confidence
  const synergySum = topEdges.reduce((s, e) => s + e.weight, 0)
  const weaknessPenalty = weaknesses.reduce((s, w) => s + (w.severity === 'major' ? 1.5 : 0.5), 0)
  const archetypeBonus = archetype.confidence * 2
  const rawPower = 5 + synergySum * 1.5 + archetypeBonus - weaknessPenalty
  const powerLevel = Math.max(1, Math.min(10, Math.round(rawPower * 10) / 10))

  // Win condition — derive from primary archetype and deck composition
  function deriveWinCondition(): string | undefined {
    const primary = archetype.primary
    switch (primary) {
      case 'poison':
        return 'Stack Poison quickly and close with Catalyst or a scaling finisher'
      case 'strength-scaling':
        return 'Ramp Strength and close with high-damage multi-hit attacks'
      case 'block-turtle':
        return 'Build infinite block via Barricade/Entrench and whittle with passive damage'
      case 'draw-engine':
        return 'Cycle through deck rapidly and combo high-value cards every turn'
      case 'exhaust':
        return 'Exhaust your deck down to a tight loop for reliable infinite combos'
      case 'orb-focus':
        return 'Stack Frost orbs for block, then evoke Lightning/Dark for burst damage'
      case 'shiv':
        return 'Flood hand with Shivs and close with Thousand Cuts or multi-hit scaling'
      case 'discard':
        return 'Cycle discard triggers for energy / damage, then burst from empty hand'
      case 'powers-heavy':
        return 'Set up your power stack early and snowball into overwhelming passives'
      case 'pet-synergy':
        return 'Maintain your pet\'s health and leverage companion abilities each turn'
      case 'star-engine':
        return 'Generate Stars and unleash Windmill Strike / Eruption for massive damage'
      default:
        return undefined
    }
  }

  const buildTargets = detectBuildTargets(deck, charKey, archetype)

  // Archetype lock warning: floor 15+ with low confidence is the #1 beginner mistake
  let archetypeLockWarning: string | undefined
  if (floor >= 15 && archetype.confidence < 0.5) {
    archetypeLockWarning = `Act 1 ending — commit to an archetype. Deck is unfocused at ${Math.round(archetype.confidence * 100)}% confidence.`
  }

  return {
    archetype,
    weaknesses,
    cardTypeBreakdown: breakdown,
    avgCost,
    totalCards: deck.length,
    keySynergies,
    powerLevel,
    winCondition: deriveWinCondition(),
    buildTargets: buildTargets.length > 0 ? buildTargets : undefined,
    archetypeLockWarning,
  }
}
