import type { GameCard, GameRelic, ActivePower } from '@/types/game-state'
import type { CodexData, CodexCard } from '@/types/codex'
import { lookupCard } from '@/types/codex'
import type { SynergyGraph, SynergyContext } from '@/types/synergy'
import type { DeckArchetype, SynergyReason } from '@/types/advisor'
import { SYNERGY_RULES } from './synergy-rules'

export function buildSynergyGraph(
  deck: GameCard[],
  codex: CodexData,
  relics: GameRelic[],
  powers: ActivePower[],
  archetype: DeckArchetype,
  character: string,
  act: number,
  floor: number,
): SynergyGraph {
  const edges = []
  const nodeIds = new Set<string>()
  const codexDeck = deck.map(c => lookupCard(codex, c.id, c.name)).filter(Boolean) as CodexCard[]
  const codexRelics = relics.map(r => codex.relicById.get(r.id)).filter(Boolean)

  for (const card of deck) {
    const cx = lookupCard(codex, card.id, card.name)
    if (!cx) continue
    nodeIds.add(card.id ?? card.name)

    const ctx: SynergyContext = {
      card: cx,
      deck,
      codexDeck,
      relics,
      codexRelics: codexRelics as CodexData['relics'],
      powers,
      archetype,
      character: character ?? '',
      act,
      floor,
    }

    for (const rule of SYNERGY_RULES) {
      if (rule.check(ctx)) {
        const score = rule.score(ctx)
        if (score !== 0) {
          edges.push({
            sourceId: card.id ?? card.name,
            targetId: 'deck',
            type: rule.edgeType,
            weight: rule.baseWeight * Math.abs(score),
            label: rule.name,
            description: rule.describe(ctx),
          })
        }
      }
    }
  }

  return { edges, nodeIds }
}

// Evaluate a candidate card against the current deck using synergy rules
export function evaluateCardSynergies(
  candidate: GameCard,
  deck: GameCard[],
  codex: CodexData,
  relics: GameRelic[],
  powers: ActivePower[],
  archetype: DeckArchetype,
  character: string,
  act: number,
  floor: number,
): SynergyReason[] {
  const cx = lookupCard(codex, candidate.id, candidate.name)
  if (!cx) return []

  const codexDeck = deck.map(c => lookupCard(codex, c.id, c.name)).filter(Boolean) as CodexCard[]
  const codexRelics = relics.map(r => codex.relicById.get(r.id)).filter(Boolean)

  const ctx: SynergyContext = {
    card: cx,
    deck,
    codexDeck,
    relics,
    codexRelics: codexRelics as CodexData['relics'],
    powers,
    archetype,
    character: character ?? '',
    act,
    floor,
  }

  const reasons: SynergyReason[] = []
  for (const rule of SYNERGY_RULES) {
    if (rule.check(ctx)) {
      const score = rule.score(ctx)
      if (score !== 0) {
        reasons.push({
          type: rule.edgeType,
          label: rule.name,
          description: rule.describe(ctx),
          weight: score * rule.baseWeight,
        })
      }
    }
  }

  return reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
}
