import type { GameCard } from '@/types/game-state'
import type { EliteContext, DeckArchetype } from '@/types/advisor'

interface EliteEntry {
  aliases: string[]
  act: number
  dangerAbilities: string[]
  recommendedStrategy: string
  avoidCards: string[]       // keywords / card names to avoid
  rewardQuality: 'low' | 'medium' | 'high'
  goodArchetypes: string[]   // archetypes that handle this elite well
  badArchetypes: string[]    // archetypes that struggle
}

const ELITE_DATA: EliteEntry[] = [
  // ─── Act 1 ───────────────────────────────────────────────────────────────
  {
    aliases: ['gremlin nob', 'nob'],
    act: 1,
    dangerAbilities: ['Enrage — gains Strength when you play a Skill'],
    recommendedStrategy: 'Play Attacks only. Playing Skills triggers Enrage (+2 Str per skill), which quickly becomes lethal.',
    avoidCards: ['Skill'],
    rewardQuality: 'medium',
    goodArchetypes: ['strength-scaling', 'shiv', 'exhaust'],
    badArchetypes: ['block-turtle', 'draw-engine', 'powers-heavy'],
  },
  {
    aliases: ['lagavulin', 'lagavulin (asleep)', 'lagavulin (awake)'],
    act: 1,
    dangerAbilities: [
      'Stasis — sleeps turns 1-3, attack freely; wakes turn 4 — switch to blocking immediately',
      'Siphon Soul — drains 1 Strength and 1 Dexterity per turn after waking; fight collapses if prolonged',
    ],
    recommendedStrategy: 'Free damage turns 1-3 while it sleeps — use your best attacks. Switch to blocking at turn 4 when it wakes. Kill before Siphon Soul drains your Strength/Dexterity too low.',
    avoidCards: [],
    rewardQuality: 'high',
    goodArchetypes: ['strength-scaling', 'draw-engine', 'orb-focus'],
    badArchetypes: ['poison', 'block-turtle'],
  },
  {
    aliases: ['sentries', 'three sentries', 'sentry'],
    act: 1,
    dangerAbilities: [
      'Beam — individual attacks',
      'Bolt — fills your discard pile with Dazed cards',
    ],
    recommendedStrategy: 'AoE to hit all three. Dazed cards clog your draw — a slim deck suffers more. Kill quickly to limit Dazed generation.',
    avoidCards: [],
    rewardQuality: 'medium',
    goodArchetypes: ['orb-focus', 'strength-scaling', 'shiv'],
    badArchetypes: ['exhaust', 'draw-engine'],
  },
  // ─── Act 2 ───────────────────────────────────────────────────────────────
  {
    aliases: ['gremlin leader', 'leader'],
    act: 2,
    dangerAbilities: [
      'Rally — keeps summoning gremlins throughout the fight',
      'Encourage — buffs all allies with Strength',
    ],
    recommendedStrategy: 'AoE to clear minions. Kill the Leader fast — it keeps summoning. Poison on Leader works well since minions die quickly to AoE.',
    avoidCards: [],
    rewardQuality: 'medium',
    goodArchetypes: ['poison', 'orb-focus', 'strength-scaling'],
    badArchetypes: ['block-turtle', 'exhaust'],
  },
  {
    aliases: ['slavers', 'blue slaver', 'red slaver'],
    act: 2,
    dangerAbilities: [
      'Entangle (Red Slaver) — locks all cards in your hand unplayable for a turn',
      'Scrape (Blue Slaver) — applies Vulnerable',
    ],
    recommendedStrategy: 'Kill the Red Slaver first — Entangle is devastating. Tanking one Entangle turn is unavoidable; have block ready.',
    avoidCards: [],
    rewardQuality: 'medium',
    goodArchetypes: ['strength-scaling', 'orb-focus', 'discard'],
    badArchetypes: ['block-turtle'],
  },
  {
    aliases: ['book of stabbing', 'stabbing'],
    act: 2,
    dangerAbilities: [
      'Multi-Stab — hit count grows each round (×2 turn 1 → ×3 turn 2 → ×4 turn 3…); becomes lethal by turn 4',
      'Cycle Reset — never stops escalating; finish by turn 3 or take extreme damage',
    ],
    recommendedStrategy: 'Hard kill target: finish by turn 3 before Multi-Stab becomes lethal. Every turn you stall adds another hit to the next Multi-Stab. Front-load all burst damage.',
    avoidCards: [],
    rewardQuality: 'medium',
    goodArchetypes: ['strength-scaling', 'poison', 'shiv'],
    badArchetypes: ['block-turtle'],
  },
  {
    aliases: ['spheric guardian'],
    act: 2,
    dangerAbilities: [
      'Activate — starts with 50 Block',
      'Slam — 10 damage × 2',
      'Harden — regains Block when certain conditions met',
    ],
    recommendedStrategy: 'Break through 50 Block first — exhaust and discard builds can stall here. Poison pierces Block slowly but effectively. High single-turn burst wins fast.',
    avoidCards: [],
    rewardQuality: 'high',
    goodArchetypes: ['poison', 'strength-scaling', 'exhaust'],
    badArchetypes: ['block-turtle', 'shiv'],
  },
  // ─── Act 3 ───────────────────────────────────────────────────────────────
  {
    aliases: ['giant head', 'the giant'],
    act: 3,
    dangerAbilities: [
      'It Is Time — deal 30+ damage. Timer counts down, attack grows if you stall',
      'Count — counts down each turn, escalating damage',
    ],
    recommendedStrategy: 'This fight is a timer — burst as fast as possible. Every turn you waste, the final attack grows. Exhaust decks that skip turns are punished hard.',
    avoidCards: [],
    rewardQuality: 'medium',
    goodArchetypes: ['strength-scaling', 'shiv', 'draw-engine'],
    badArchetypes: ['block-turtle', 'exhaust'],
  },
  {
    aliases: ['nemesis'],
    act: 3,
    dangerAbilities: [
      'Intangible — reduces all damage to 1 for several turns',
      'Attack — high damage outside Intangible window',
    ],
    recommendedStrategy: 'DOT effects (Poison, Burn) bypass Intangible. Save burst for non-Intangible turns. Block during Intangible windows. Poison is best archetype here.',
    avoidCards: [],
    rewardQuality: 'high',
    goodArchetypes: ['poison', 'block-turtle', 'orb-focus'],
    badArchetypes: ['strength-scaling', 'shiv'],
  },
  {
    aliases: ['reptomancer'],
    act: 3,
    dangerAbilities: [
      'Summon Daggers — spawns two Dagger minions early',
      'Snake Strike — hits and applies Weak',
    ],
    recommendedStrategy: 'AoE to clear the two Daggers. Kill Daggers early — they hit hard. Then burst Reptomancer down. Two-target AoE excels here.',
    avoidCards: [],
    rewardQuality: 'high',
    goodArchetypes: ['orb-focus', 'strength-scaling', 'poison'],
    badArchetypes: ['exhaust', 'block-turtle'],
  },
]

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
}

function findEliteEntry(enemyName: string): EliteEntry | null {
  const normalized = normalizeName(enemyName)
  // Use exact match or whole-word containment to avoid false positives
  return ELITE_DATA.find(e =>
    e.aliases.some(a => {
      if (normalized === a) return true
      const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(normalized)
    })
  ) ?? null
}

/** Estimate how hard this elite is for the given deck (used for path coloring) */
export function getEliteDifficulty(
  eliteName: string,
  archetype: DeckArchetype,
  deck: GameCard[],
): 'easy' | 'neutral' | 'hard' {
  const entry = findEliteEntry(eliteName)
  if (!entry) return 'neutral'

  if (entry.goodArchetypes.includes(archetype.primary)) return 'easy'
  if (entry.badArchetypes.includes(archetype.primary)) return 'hard'

  // Check for specific anti-synergy (skill-only decks vs Gremlin Nob)
  if (entry.avoidCards.includes('Skill')) {
    const skillRatio = deck.filter(c => c.type === 'Skill').length / Math.max(1, deck.length)
    if (skillRatio > 0.6) return 'hard'
  }

  return 'neutral'
}

export function getEliteContext(
  enemyName: string,
  archetype: DeckArchetype,
  deck: GameCard[],
): EliteContext | null {
  const entry = findEliteEntry(enemyName)
  if (!entry) return null

  return {
    eliteName: enemyName,
    dangerAbilities: entry.dangerAbilities,
    recommendedStrategy: entry.recommendedStrategy,
    avoidCards: entry.avoidCards,
    rewardQuality: entry.rewardQuality,
  }
}

/** Get all known elite names for a given act (for map labeling) */
export function getActElites(act: number): string[] {
  return ELITE_DATA.filter(e => e.act === act).map(e => e.aliases[0])
}
