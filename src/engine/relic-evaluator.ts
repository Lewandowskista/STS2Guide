import type { GameCard, GameRelic, ActivePower } from '@/types/game-state'
import type { CodexData } from '@/types/codex'
import type { RelicEvaluation, DeckArchetype, SynergyReason } from '@/types/advisor'
import { scoreToRating } from '@/types/advisor'

/**
 * Relics that enable build strategies — their value peaks in Act 1 when there
 * is still time to build around them.  Act 3 picks benefit less.
 */
const BUILD_ENABLER_RELICS = new Set([
  'dead branch', 'charon', 'rupture', 'velvet choker', 'kunai', 'shuriken',
  'wrist blade', 'twisted funnel', 'frozen core', 'nuclear battery', 'inserter',
])

/**
 * Defensive relics that shore up survivability — most valuable late-game when
 * enemy damage is highest and the run result is on the line.
 */
const DEFENSIVE_RELICS = new Set([
  'torii', 'tungsten rod', 'old coin', 'meat on the bone', 'spirit poop',
  'happy flower', 'medical kit', 'anchor',
])

const RARITY_BASE: Record<string, number> = {
  Starter: 3,
  Common: 5,
  Uncommon: 6,
  Rare: 7.5,
  Boss: 8,
  Special: 6.5,
}

// Comprehensive archetype → core relic mappings with explanations
const ARCHETYPE_RELIC_SYNERGIES: Record<string, Array<{ ids: string[]; label: string; description: string; bonus: number }>> = {
  'strength-scaling': [
    { ids: ['Akabeko', 'Vajra'], label: 'Strength Opener', description: 'Starts combats with extra Strength', bonus: 2.5 },
    { ids: ['Paper Crane', 'Paper Frog'], label: 'Damage Amplifier', description: '+25% damage from Weak/Vulnerable', bonus: 2 },
    { ids: ['Strike Dummy', 'Brimstone', 'Bag of Preparation'], label: 'Strength Amplifier', description: 'Amplifies attack damage with Strength build', bonus: 2 },
    { ids: ['Meat on the Bone', 'Centennial Puzzle'], label: 'HP Regen', description: 'Helps survive long enough to scale Strength', bonus: 1 },
  ],
  'block-turtle': [
    { ids: ['Calipers'], label: 'Retain Block', description: 'Keeps 15 block between turns — essential for turtling', bonus: 3 },
    { ids: ['Orichalcum'], label: 'Free Block', description: '6 free block if you end turn without block — core for turtles', bonus: 2.5 },
    { ids: ['Anchor', 'Boot', 'Oddly Smooth Stone'], label: 'Block Start', description: 'Extra block at combat start', bonus: 1.5 },
    { ids: ['Ginger', 'Turnip'], label: 'Debuff Immunity', description: 'Prevents Weak/Frail — protects block generation', bonus: 1.5 },
  ],
  'draw-engine': [
    { ids: ['Bag of Preparation', 'Bag of Marbles'], label: 'Card Draw Start', description: 'Extra cards at combat start for draw engines', bonus: 2 },
    { ids: ['Bottled Lightning', 'Bottled Flame', 'Bottled Tornado'], label: 'Consistent Opener', description: 'Guarantees a key card in opening hand', bonus: 2 },
    { ids: ['Sundial', 'Unceasing Top'], label: 'Draw Payoff', description: 'Rewards cycling through deck', bonus: 2.5 },
  ],
  'exhaust': [
    { ids: ['Charon', "Dead Branch"], label: 'Exhaust Payoff', description: 'Generates a random card on exhaust', bonus: 3 },
    { ids: ['Rupture'], label: 'Strength on Exhaust', description: 'Gain Strength when you exhaust — core exhaust relic', bonus: 2.5 },
    { ids: ['Strange Spoon'], label: 'Exhaust Prevent', description: 'Prevents exhaust 50% of time — can be anti-synergy for exhaust builds', bonus: -1 },
    { ids: ['Feel No Pain', 'Dark Embrace'], label: 'Exhaust Trigger', description: 'Triggers on every exhaust', bonus: 2 },
  ],
  'orb-focus': [
    { ids: ['Frozen Core'], label: 'Free Orb Slot', description: 'Channels a Frost orb when empty — sustains orb count', bonus: 2.5 },
    { ids: ['Nuclear Battery'], label: 'Plasma Orb', description: 'Starts combat with a Plasma orb — 1 extra energy', bonus: 2 },
    { ids: ['Inserter'], label: 'Orb Trigger', description: 'Orbs trigger twice every other turn', bonus: 3 },
    { ids: ['Data Disk'], label: 'Focus Start', description: 'Starts combat with 1 Focus — all orbs stronger', bonus: 2 },
    { ids: ['Emotion Chip', 'Runic Capacitor'], label: 'Orb Amplifier', description: 'Increases orb power significantly', bonus: 2.5 },
  ],
  'poison': [
    { ids: ['Twisted Funnel'], label: 'Mass Poison', description: 'Applies 4 poison to ALL enemies at combat start', bonus: 3 },
    { ids: ['Snecko Eye'], label: 'Random Costs', description: 'Randomizes card costs — 50/50 for poison builds needing multiple cards', bonus: 1 },
    { ids: ['Nunchaku', 'Chemical X'], label: 'Poison Amplifier', description: 'Scales Catalyst double-poison mechanic', bonus: 1.5 },
    { ids: ['Tingsha', 'Inserter'], label: 'Poison Trigger', description: 'Deals extra damage at end of turn for poison builds', bonus: 2 },
  ],
  'shiv': [
    { ids: ['Kunai', 'Shuriken'], label: 'Shiv Payoff', description: 'Every 3 attacks: gain Dexterity/Strength — core for shiv builds', bonus: 3 },
    { ids: ['Wrist Blade'], label: 'Shiv Damage', description: 'Shivs deal 4 more damage — major DPS boost', bonus: 3 },
    { ids: ['Leather Belt'], label: 'Thousand Cuts', description: 'Scales damage with every shiv played', bonus: 2 },
    { ids: ['Nunchaku'], label: 'Energy Refund', description: 'Every 10 attacks: gain 1 energy — great for shiv spam', bonus: 2 },
  ],
  'discard': [
    { ids: ['Tingsha'], label: 'Discard Damage', description: 'Deals 3 damage to random enemy when discarding — discard payoff', bonus: 3 },
    { ids: ['Tough Bandages'], label: 'Discard Block', description: 'Gains 3 block per discard — discard payoff', bonus: 3 },
    { ids: ['Empty Cage', 'Runic Pyramid'], label: 'Hand Retention', description: 'Keeps hand between turns — pairs with discard power cards', bonus: 2 },
  ],
  'powers-heavy': [
    { ids: ['Akashic Record', 'Symbiotic Virus'], label: 'Power Amplifier', description: 'Amplifies power-heavy strategies', bonus: 2 },
    { ids: ['Bottled Tornado'], label: 'Guaranteed Power', description: 'Guarantees a power card in opening hand', bonus: 2.5 },
    { ids: ['Mummified Hand'], label: 'Power Cost Reduction', description: 'Random card becomes 0 cost when playing powers', bonus: 2 },
    { ids: ['Cloak Clasp'], label: 'Hand End Block', description: 'Block equals cards in hand at end — powerful with power-heavy hands', bonus: 1.5 },
  ],
}

// Generic relic effects that always help
const GENERIC_GOOD_RELICS = [
  { ids: ['Philosopher\'s Stone', 'Cursed Key'], label: 'Risk/Reward', bonus: -0.5, description: 'Provides power at a cost — assess current HP' },
  { ids: ['Medical Kit'], label: 'Status Removal', bonus: 1, description: 'Removes status cards from hand — always useful' },
]

function scoreRelicForDeck(
  relic: GameRelic,
  codex: CodexData,
  deck: GameCard[],
  existingRelics: GameRelic[],
  archetype: DeckArchetype,
  act = 1,
): { score: number; reasons: SynergyReason[] } {
  const cr = codex.relicById.get(relic.id)
  if (!cr) return { score: 5, reasons: [] }

  const base = RARITY_BASE[cr.rarity] ?? 5
  const reasons: SynergyReason[] = []
  let bonus = 0

  const desc = (cr.description ?? '').toLowerCase()
  const relicName = (cr.name ?? relic.name ?? '').toLowerCase()
  const codexDeck = deck.map(c => c.id ? codex.cardById.get(c.id) : codex.cardByName?.get(c.name.toLowerCase())).filter(Boolean)

  const attackCount = codexDeck.filter(c => c?.type === 'Attack').length
  const skillCount = codexDeck.filter(c => c?.type === 'Skill').length
  const powerCount = codexDeck.filter(c => c?.type === 'Power').length
  const blockCount = codexDeck.filter(c => (c?.block ?? 0) > 0).length
  const exhaustCount = codexDeck.filter(c => c?.keywords?.some(k => k.toLowerCase() === 'exhaust')).length
  const hasStrengthSource = codexDeck.some(c => c?.powers_applied?.some(p => p.power.toLowerCase().includes('strength')))
  const hasPoisonSource = codexDeck.some(c => c?.powers_applied?.some(p => p.power.toLowerCase().includes('poison')))

  // Generic description-based synergy checks
  const synergyChecks: Array<{ keyword: string; deckCheck: () => boolean; label: string; description: string; bonus: number }> = [
    {
      keyword: 'attack',
      deckCheck: () => attackCount >= 7,
      label: 'Attack Synergy',
      description: `Triggers on attacks — you have ${attackCount} attack cards`,
      bonus: Math.min(2, attackCount * 0.15),
    },
    {
      keyword: 'skill',
      deckCheck: () => skillCount >= 7,
      label: 'Skill Synergy',
      description: `Triggers on skills — you have ${skillCount} skill cards`,
      bonus: Math.min(2, skillCount * 0.15),
    },
    {
      keyword: 'power',
      deckCheck: () => powerCount >= 3,
      label: 'Power Synergy',
      description: `Triggers on powers — you have ${powerCount} power cards`,
      bonus: Math.min(2, powerCount * 0.25),
    },
    {
      keyword: 'exhaust',
      deckCheck: () => exhaustCount >= 2,
      label: 'Exhaust Synergy',
      description: `Triggers on exhaust — you have ${exhaustCount} exhaust cards`,
      bonus: exhaustCount >= 4 ? 2.5 : 1.5,
    },
    {
      keyword: 'strength',
      deckCheck: () => hasStrengthSource,
      label: 'Strength Amplifier',
      description: 'Deck builds Strength — this relic amplifies it',
      bonus: 2,
    },
    {
      keyword: 'poison',
      deckCheck: () => hasPoisonSource,
      label: 'Poison Amplifier',
      description: 'Deck applies Poison — this relic amplifies it',
      bonus: 2,
    },
    {
      keyword: 'block',
      deckCheck: () => blockCount >= 5,
      label: 'Block Synergy',
      description: `Block-heavy deck (${blockCount} block cards) benefits from this`,
      bonus: Math.min(2, blockCount * 0.2),
    },
    {
      keyword: 'gold',
      deckCheck: () => true,
      label: 'Gold Generation',
      description: 'Provides gold for shop options',
      bonus: 0.5,
    },
  ]

  for (const check of synergyChecks) {
    if (desc.includes(check.keyword) && check.deckCheck()) {
      const b = check.bonus
      bonus += b
      reasons.push({ type: 'relic-amplification', label: check.label, description: check.description, weight: b })
    }
  }

  // Archetype-specific relic synergies (most important)
  const archetypeSynergies = ARCHETYPE_RELIC_SYNERGIES[archetype.primary] ?? []
  for (const syn of archetypeSynergies) {
    const matches = syn.ids.some(id =>
      relic.id?.toLowerCase().includes(id.toLowerCase()) ||
      relicName.includes(id.toLowerCase())
    )
    if (matches) {
      // Scale bonus by archetype confidence
      const scaledBonus = syn.bonus * Math.max(0.5, archetype.confidence)
      bonus += scaledBonus
      reasons.push({
        type: 'archetype-core',
        label: syn.label,
        description: `[${archetype.label}] ${syn.description}`,
        weight: scaledBonus,
      })
      break // Only apply the first matching synergy per archetype group
    }
  }

  // Secondary archetype synergies (half weight)
  if (archetype.secondary) {
    const secondarySynergies = ARCHETYPE_RELIC_SYNERGIES[archetype.secondary] ?? []
    for (const syn of secondarySynergies) {
      const matches = syn.ids.some(id =>
        relic.id?.toLowerCase().includes(id.toLowerCase()) ||
        relicName.includes(id.toLowerCase())
      )
      if (matches) {
        const scaledBonus = syn.bonus * 0.5 * archetype.confidence
        bonus += scaledBonus
        reasons.push({
          type: 'secondary-synergy',
          label: `${syn.label} (secondary)`,
          description: `[${archetype.secondary}] ${syn.description}`,
          weight: scaledBonus,
        })
        break
      }
    }
  }

  // Anti-synergy detection — penalize relics that conflict with build
  if (archetype.primary === 'exhaust') {
    if (relicName.includes('strange spoon') || desc.includes('50% chance') && desc.includes('exhaust')) {
      bonus -= 2
      reasons.push({ type: 'anti-synergy', label: 'Exhaust Anti-Synergy', description: 'Prevents exhausting — bad for exhaust build', weight: -2 })
    }
  }
  if (archetype.primary === 'block-turtle' && desc.includes('lose') && desc.includes('block')) {
    bonus -= 1.5
    reasons.push({ type: 'anti-synergy', label: 'Block Removal', description: 'Removes block — bad for turtle build', weight: -1.5 })
  }

  // Already have a similar relic? Diminishing returns.
  // Compare full normalized names to avoid false matches from short-prefix slicing.
  const isDuplicate = existingRelics.some(r => {
    if (r.id === relic.id) return false
    const existingNorm = (r.name ?? '').toLowerCase().trim()
    // Exact name match after normalization
    if (existingNorm === relicName) return true
    // Check by relic ID for definitive duplicate detection when IDs are available
    const existingCodex = codex.relicById.get(r.id)
    const candidateCodex = cr
    if (existingCodex && candidateCodex && existingCodex.id === candidateCodex.id) return true
    return false
  })
  if (isDuplicate) {
    bonus -= 1
    reasons.push({ type: 'diminishing-returns', label: 'Overlapping Effect', description: 'Similar relic already owned', weight: -1 })
  }

  // Relic durability — check counter field (0 = expended, 1-2 = nearly spent)
  if (relic.counter !== null && relic.counter !== undefined) {
    if (relic.counter === 0) {
      bonus -= 1.5
      reasons.push({ type: 'durability', label: 'Expended', description: 'No remaining charges — this relic has no effect left', weight: -1.5 })
    } else if (relic.counter <= 2) {
      bonus -= 0.5
      reasons.push({ type: 'durability', label: 'Limited Charges', description: `Only ${relic.counter} charge(s) remaining — weak for long fights`, weight: -0.5 })
    }
  }

  // Scan existing relics for expended charges — warn if already have spent relics
  // (this is informational only, doesn't affect candidate score)

  // Act-based timing adjustment:
  // Build-enabling relics are most valuable early (Act 1) — less so late when you can't exploit them fully.
  // Defensive relics peak in Act 3 when survivability matters most.
  if (BUILD_ENABLER_RELICS.has(relicName)) {
    if (act === 1) {
      bonus += 0.5
      reasons.push({ type: 'timing', label: 'Early Build Enabler', description: 'Picked in Act 1 — maximum time to build around this relic', weight: 0.5 })
    } else if (act >= 3) {
      bonus -= 0.5
      reasons.push({ type: 'timing', label: 'Late Pick', description: 'Build-enabling relic picked late — less time to exploit it', weight: -0.5 })
    }
  } else if (DEFENSIVE_RELICS.has(relicName) && act >= 3) {
    bonus += 0.4
    reasons.push({ type: 'timing', label: 'Late-Game Defense', description: 'Defensive relic is most valuable in Act 3+', weight: 0.4 })
  }

  const score = Math.max(1, Math.min(10, base + bonus))
  return { score, reasons: reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)) }
}

export function evaluateRelics(
  candidates: GameRelic[],
  deck: GameCard[],
  existingRelics: GameRelic[],
  codex: CodexData,
  archetype: DeckArchetype,
  _powers: ActivePower[],
  act = 1,
): RelicEvaluation[] {
  return candidates.map(relic => {
    const { score, reasons } = scoreRelicForDeck(relic, codex, deck, existingRelics, archetype, act)
    return {
      relic,
      score,
      rating: scoreToRating(score),
      reasons,
    }
  }).sort((a, b) => b.score - a.score)
}
