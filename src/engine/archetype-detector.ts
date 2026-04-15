import type { GameCard, GameRelic, ActivePower } from '@/types/game-state'
import type { CodexData } from '@/types/codex'
import { lookupCard } from '@/types/codex'
import type { ArchetypeId, DeckArchetype } from '@/types/advisor'
import type { ArchetypeSignal } from '@/types/synergy'
import { ARCHETYPE_MIN_DECK_SIZE, ARCHETYPE_MIN_DECK_SIZE_BY_CHARACTER } from './constants'

const ARCHETYPE_SIGNALS: ArchetypeSignal[] = [
  {
    archetype: 'strength-scaling',
    label: 'Strength Scaling',
    minScore: 2,
    indicators: [
      { type: 'card-keyword', match: ['Strength', 'strength'], weight: 1.5 },
      { type: 'card-id', match: ['Flex', 'Limit Break', 'Inflame', 'Spot Weakness', 'Battle Hymn'], weight: 1.2 },
      { type: 'card-tag', match: ['strength_gain'], weight: 1.5 },
    ],
  },
  {
    archetype: 'block-turtle',
    label: 'Block / Turtle',
    minScore: 2,
    indicators: [
      { type: 'card-keyword', match: ['Barricade', 'Entrench'], weight: 2.0 },
      { type: 'card-id', match: ['Barricade', 'Body Slam', 'Entrench', 'Impervious', 'Fortress'], weight: 1.5 },
      { type: 'card-type', match: 'Skill', weight: 0.2 },
    ],
  },
  {
    archetype: 'draw-engine',
    label: 'Draw Engine',
    minScore: 2,
    indicators: [
      { type: 'card-keyword', match: ['draw'], weight: 0.8 },
      { type: 'card-id', match: ['Acrobatics', 'Adrenaline', 'Expertise', 'Bullet Time', 'Streamline'], weight: 1.3 },
    ],
  },
  {
    archetype: 'exhaust',
    label: 'Exhaust Build',
    minScore: 2,
    indicators: [
      { type: 'card-keyword', match: ['Exhaust'], weight: 0.7 },
      { type: 'card-id', match: ['Feel No Pain', 'Dark Embrace', 'Sentinel', 'Corruption'], weight: 2.0 },
      { type: 'relic-id', match: ['Charon', 'Rupture'], weight: 1.5 },
    ],
  },
  {
    archetype: 'orb-focus',
    label: 'Orb Focus',
    minScore: 2,
    indicators: [
      { type: 'card-keyword', match: ['Channel', 'Evoke', 'Orb'], weight: 1.0 },
      { type: 'card-id', match: ['Ball Lightning', 'Glacier', 'Blizzard', 'Defragment', 'Electrodynamics'], weight: 1.5 },
    ],
  },
  {
    archetype: 'poison',
    label: 'Poison',
    minScore: 2,
    indicators: [
      { type: 'card-keyword', match: ['Poison'], weight: 1.2 },
      { type: 'card-id', match: ['Noxious Fumes', 'Deadly Poison', 'Catalyst', 'Corpse Explosion'], weight: 1.5 },
    ],
  },
  {
    archetype: 'shiv',
    label: 'Shiv / Multi-Hit',
    minScore: 2,
    indicators: [
      { type: 'card-keyword', match: ['Shiv', 'multi-hit'], weight: 1.5 },
      { type: 'card-id', match: ['Blade Dance', 'Cloak And Dagger', 'Thousand Cuts', 'Hand of Greed'], weight: 1.5 },
    ],
  },
  {
    archetype: 'discard',
    label: 'Discard Build',
    minScore: 2,
    indicators: [
      { type: 'card-keyword', match: ['Discard'], weight: 1.0 },
      { type: 'card-id', match: ['Wraith Form', 'Tactician', 'Reflex', 'Acrobatics'], weight: 1.2 },
    ],
  },
  {
    archetype: 'powers-heavy',
    label: 'Powers Heavy',
    minScore: 3,
    indicators: [
      { type: 'card-type', match: 'Power', weight: 0.8 },
      { type: 'card-id', match: ['Devotion', 'Sanctity', 'Mantra', 'Spirit Shield'], weight: 1.5 },
    ],
  },
  {
    archetype: 'pet-synergy',
    label: 'Pet Synergy',
    minScore: 2,
    indicators: [
      { type: 'card-keyword', match: ['Pet', 'pet'], weight: 1.5 },
      { type: 'card-tag', match: ['pet'], weight: 1.5 },
    ],
  },
  {
    archetype: 'star-engine',
    label: 'Star Engine',
    minScore: 2,
    indicators: [
      { type: 'card-keyword', match: ['Star', 'star'], weight: 1.5 },
      { type: 'card-id', match: ['Windmill Strike', 'Eruption', 'Reach Heaven'], weight: 1.5 },
    ],
  },
]

function scoreArchetype(
  signal: ArchetypeSignal,
  deck: GameCard[],
  codex: CodexData,
  relics: GameRelic[],
  powers: ActivePower[],
): number {
  let score = 0
  for (const indicator of signal.indicators) {
    for (const card of deck) {
      const cx = lookupCard(codex, card.id, card.name)
      if (!cx) continue

      switch (indicator.type) {
        case 'card-keyword': {
          const matches = Array.isArray(indicator.match) ? indicator.match : [indicator.match]
          if (cx.keywords?.some(k => matches.some(m => k.toLowerCase().includes(m.toLowerCase())))) {
            score += indicator.weight
          }
          break
        }
        case 'card-id': {
          const matches = Array.isArray(indicator.match) ? indicator.match : [indicator.match]
          if (matches.some(m => cx.id.includes(m) || cx.name.includes(m))) {
            score += indicator.weight
          }
          break
        }
        case 'card-type': {
          if (cx.type === indicator.match) score += indicator.weight
          break
        }
        case 'card-tag': {
          const matches = Array.isArray(indicator.match) ? indicator.match : [indicator.match]
          if (cx.tags?.some(t => matches.some(m => t.toLowerCase().includes(m.toLowerCase())))) {
            score += indicator.weight
          }
          break
        }
      }
    }

    // Check relics
    if (indicator.type === 'relic-id') {
      const matches = Array.isArray(indicator.match) ? indicator.match : [indicator.match]
      for (const relic of relics) {
        if (matches.some(m => relic.id.includes(m) || relic.name?.includes(m))) {
          score += indicator.weight * 1.5 // relics have high signal value
        }
      }
    }

    // Check active powers
    if (indicator.type === 'power-present') {
      const matches = Array.isArray(indicator.match) ? indicator.match : [indicator.match]
      for (const power of powers) {
        if (matches.some(m => power.id.includes(m) || power.name.includes(m))) {
          score += indicator.weight
        }
      }
    }
  }
  return score
}

/**
 * Relics that so definitively enable a build strategy that they should override
 * the card-pool-based archetype detection when floor >= 10.
 */
const RELIC_OVERRIDE_ARCHETYPES: Record<string, ArchetypeId> = {
  'twisted funnel': 'poison',
  'dead branch': 'exhaust',
  'calipers': 'block-turtle',
  'inserter': 'orb-focus',
  'nuclear battery': 'orb-focus',
  'kunai': 'shiv',
  'shuriken': 'shiv',
}

const RELIC_OVERRIDE_LABELS: Record<ArchetypeId, string> = {
  'poison': 'Poison',
  'exhaust': 'Exhaust Build',
  'block-turtle': 'Block / Turtle',
  'orb-focus': 'Orb Focus',
  'shiv': 'Shiv / Multi-Hit',
  'strength-scaling': 'Strength Scaling',
  'draw-engine': 'Draw Engine',
  'discard': 'Discard Build',
  'powers-heavy': 'Powers Heavy',
  'pet-synergy': 'Pet Synergy',
  'star-engine': 'Star Engine',
  'balanced': 'Balanced / Undecided',
}

export function detectArchetype(
  deck: GameCard[],
  codex: CodexData,
  relics: GameRelic[],
  powers: ActivePower[] = [],
  characterId?: string,
  floor?: number,
): DeckArchetype {
  const charKey = (characterId ?? '').toLowerCase()
  const minSize = ARCHETYPE_MIN_DECK_SIZE_BY_CHARACTER[charKey] ?? ARCHETYPE_MIN_DECK_SIZE
  if (deck.length < minSize) {
    return { primary: 'balanced', secondary: null, confidence: 0, label: 'Undecided' }
  }

  // Relic-carry override: if a definitively build-defining relic is owned at floor ≥ 10,
  // force the primary archetype — card pool still determines secondary.
  if ((floor ?? 0) >= 10) {
    for (const relic of relics) {
      const relicNameNorm = (relic.name ?? '').toLowerCase()
      const relicIdNorm = (relic.id ?? '').toLowerCase()
      for (const [key, archId] of Object.entries(RELIC_OVERRIDE_ARCHETYPES)) {
        if (relicNameNorm.includes(key) || relicIdNorm.includes(key)) {
          // Run normal scoring to get secondary archetype
          const scores = ARCHETYPE_SIGNALS.map(signal => ({
            archetype: signal.archetype,
            label: signal.label,
            score: scoreArchetype(signal, deck, codex, relics, powers),
            minScore: signal.minScore,
          })).filter(s => s.score >= s.minScore && s.archetype !== archId)
          scores.sort((a, b) => b.score - a.score)
          return {
            primary: archId,
            secondary: scores[0]?.archetype ?? null,
            confidence: 0.75,
            label: RELIC_OVERRIDE_LABELS[archId] ?? archId,
          }
        }
      }
    }
  }

  const scores = ARCHETYPE_SIGNALS.map(signal => ({
    archetype: signal.archetype,
    label: signal.label,
    score: scoreArchetype(signal, deck, codex, relics, powers),
    minScore: signal.minScore,
  })).filter(s => s.score >= s.minScore)

  scores.sort((a, b) => b.score - a.score)

  if (scores.length === 0) {
    return { primary: 'balanced', secondary: null, confidence: 0.1, label: 'Balanced / Undecided' }
  }

  const top = scores[0]
  const second = scores[1]
  // Confidence = how dominant the top archetype is vs. the second-best competitor.
  // 1.0 = complete dominance; 0.5 = tied with second. Falls back to 0.8 if no competitor.
  const confidence = second
    ? top.score / (top.score + second.score)
    : 0.8

  return {
    primary: top.archetype,
    secondary: scores[1]?.archetype ?? null,
    confidence,
    label: confidence > 0.6 ? top.label : `${top.label} / ${scores[1]?.label ?? 'Mixed'}`,
  }
}
