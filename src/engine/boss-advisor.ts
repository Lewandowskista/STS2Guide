import type { GameCard, GameRelic } from '@/types/game-state'
import type { BossContext, DeckArchetype } from '@/types/advisor'
import { FLOORS_PER_ACT, NEAR_BOSS_LOOKAHEAD } from './constants'

interface BossEntry {
  aliases: string[]           // name variants the API may return
  threatMoves: Array<{ name: string; description: string; turnEstimate?: number }>
  counterAdvice: string
  countersArchetypes: string[]  // archetypes that handle this boss well
  weakArchetypes: string[]      // archetypes that struggle
  needsAoe: boolean
  needsScaling: boolean
  needsBlock: boolean
}

const BOSS_DATA: BossEntry[] = [
  // ─── Act 1 ───────────────────────────────────────────────────────────────
  {
    aliases: ['the guardian', 'guardian'],
    threatMoves: [
      { name: 'Whirlwind', description: 'Deals 5 damage 4 times — massive AoE spike', turnEstimate: 3 },
      { name: 'Charging Up', description: 'Charges; next move is Whirlwind — stock block now' },
      { name: 'Defensive Mode', description: 'Gains Thorns 9 — avoid attacking with weak hits' },
    ],
    counterAdvice: 'Save block cards for Whirlwind. Avoid small multi-hit attacks when Thorns are active. Burst during open windows.',
    countersArchetypes: ['block-turtle', 'exhaust', 'strength-scaling'],
    weakArchetypes: ['shiv', 'poison'],
    needsAoe: false,
    needsScaling: true,
    needsBlock: true,
  },
  {
    aliases: ['hexaghost', 'hex ghost'],
    threatMoves: [
      { name: 'Inferno', description: 'Deals damage equal to current HP × 6 total — stay healthy', turnEstimate: 7 },
      { name: 'Sear', description: 'Burns cards in hand — reduces effective hand size' },
      { name: 'Activate', description: 'Activates on round 1, scaling cycle applies throughout fight' },
    ],
    counterAdvice: 'Enter the fight at high HP — Inferno scales off your current HP. Remove burned cards if possible. Poison and DoT are less effective; burst damage is king.',
    countersArchetypes: ['strength-scaling', 'draw-engine', 'exhaust'],
    weakArchetypes: ['poison', 'block-turtle'],
    needsAoe: false,
    needsScaling: false,
    needsBlock: false,
  },
  {
    aliases: ['slime boss', 'the slime boss'],
    threatMoves: [
      { name: 'Slam', description: '35 damage — high single hit' },
      { name: 'Split', description: 'Splits into two slimes at 50% HP — prepare for split timing' },
    ],
    counterAdvice: 'AoE shines after Split. Plan your damage to burst through 50% HP threshold in one big turn to control when the split happens.',
    countersArchetypes: ['orb-focus', 'strength-scaling', 'poison'],
    weakArchetypes: ['block-turtle'],
    needsAoe: true,
    needsScaling: false,
    needsBlock: false,
  },
  // ─── Act 2 ───────────────────────────────────────────────────────────────
  {
    aliases: ['the champ', 'champ', 'champion'],
    threatMoves: [
      { name: 'Face Slap', description: 'Applies Weak and Frail — dramatically reduces offense/defense' },
      { name: 'Headbutt', description: 'High single damage' },
      { name: 'Defensive Stance', description: 'Gains Artifact, then heavy attacks — burst before Artifact activates', turnEstimate: 2 },
    ],
    counterAdvice: 'Burst hard in the first 2 turns before Artifact activates. Once Face Slap lands, your damage and block suffer — plan around it with Strength stacking.',
    countersArchetypes: ['strength-scaling', 'exhaust', 'orb-focus'],
    weakArchetypes: ['block-turtle', 'draw-engine'],
    needsAoe: false,
    needsScaling: true,
    needsBlock: false,
  },
  {
    aliases: ['automaton', 'the automaton', 'bronze automaton'],
    threatMoves: [
      { name: 'Hyperbeam', description: 'Massive single-hit — 50 damage. Plan block or kill before it fires', turnEstimate: 5 },
      { name: 'Spawn Orbs', description: 'Creates orb minions — handle them or focus automaton' },
      { name: 'Stunned', description: 'Automaton is stunned for 1 turn — free damage window' },
    ],
    counterAdvice: 'AoE handles the spawned orbs. Save your biggest burst for the stunned window. Block the Hyperbeam — 50 damage will kill low-HP builds.',
    countersArchetypes: ['orb-focus', 'poison', 'strength-scaling'],
    weakArchetypes: ['block-turtle'],
    needsAoe: true,
    needsScaling: false,
    needsBlock: true,
  },
  {
    aliases: ['collector', 'the collector'],
    threatMoves: [
      { name: 'Buff Minions', description: 'Empowers minions each turn — kill minions or the Collector first' },
      { name: 'Mega Buff', description: 'Massive strength/speed boost — can become lethal if ignored' },
      { name: 'Fire', description: 'Multi-target fire attack' },
    ],
    counterAdvice: 'AoE is critical — kill minions before they stack buffs. Prioritise the Collector if your AoE is limited. Poison on the Collector works well.',
    countersArchetypes: ['poison', 'orb-focus', 'strength-scaling'],
    weakArchetypes: ['shiv', 'exhaust'],
    needsAoe: true,
    needsScaling: false,
    needsBlock: false,
  },
  // ─── Act 3 ───────────────────────────────────────────────────────────────
  {
    aliases: ['time eater', 'the time eater'],
    threatMoves: [
      { name: 'Reverberate', description: 'Slows you after 12 cards played — spreads turns, denies burst', turnEstimate: 1 },
      { name: 'Ripple', description: '18 damage — can stack up over slowed turns' },
    ],
    counterAdvice: 'Play ≤12 cards per turn to avoid Reverberate. Low-cost high-value cards (Ironclad exhaust, Orb evokers) shine here. Avoid draw-heavy combos that flood your hand.',
    countersArchetypes: ['exhaust', 'block-turtle', 'strength-scaling'],
    weakArchetypes: ['draw-engine', 'shiv'],
    needsAoe: false,
    needsScaling: false,
    needsBlock: true,
  },
  {
    aliases: ['awakened one', 'the awakened one'],
    threatMoves: [
      { name: 'Scratch', description: 'Applies Vulnerable to you — amplifies all incoming damage' },
      { name: 'Rebirth', description: 'Revives at 50% HP in phase 2 — prepare for a long fight' },
      { name: 'Dark Echo', description: 'Phase 2 attack — heavy damage with Strength scaling' },
    ],
    counterAdvice: 'Two-phase fight. Heavy scaling decks shine here — you need sustained damage over two phases. Block the Rebirth phase carefully. Avoid relying on one big burst; you need to deal damage twice.',
    countersArchetypes: ['poison', 'strength-scaling', 'orb-focus'],
    weakArchetypes: ['exhaust'],
    needsAoe: false,
    needsScaling: true,
    needsBlock: false,
  },
  {
    aliases: ['donu and deca', 'donu', 'deca'],
    threatMoves: [
      { name: 'Circle of Power', description: 'Donu gives Deca +3 Strength each turn — kills Deca first priority' },
      { name: 'Beam', description: 'Deca fires massive beam — single large hit' },
      { name: 'Square of Protection', description: 'Deca gains 40 Block — burst through it or kill Donu first' },
    ],
    counterAdvice: 'Kill Deca first — Donu alone is manageable. Do not let Deca stack Strength. AoE only helps if you can hit both; single-target burst on Deca is preferred.',
    countersArchetypes: ['strength-scaling', 'exhaust', 'orb-focus'],
    weakArchetypes: ['poison', 'block-turtle'],
    needsAoe: false,
    needsScaling: true,
    needsBlock: false,
  },
  // ─── STS2-exclusive bosses ────────────────────────────────────────────────
  {
    aliases: ['vantom'],
    threatMoves: [
      { name: 'Phase Shift', description: 'Becomes untargetable briefly — save attacks for vulnerable windows' },
      { name: 'Shadow Spike', description: 'Large unblockable burst on turn 3 — bank block before this hits', turnEstimate: 3 },
      { name: 'Drain', description: 'Removes Block from player before attacking' },
    ],
    counterAdvice: 'Bank block before turn 3 Shadow Spike. Exhaust decks thin variance and hit the damage window consistently. Block generation is essential — raw HP cannot tank this fight.',
    countersArchetypes: ['block-turtle', 'exhaust'],
    weakArchetypes: ['poison', 'draw-engine'],
    needsAoe: false,
    needsScaling: false,
    needsBlock: true,
  },
  {
    aliases: ['ceremonial beast'],
    threatMoves: [
      { name: 'Ritual', description: 'Gains Strength each turn — damage escalates fast, must end fight quickly' },
      { name: 'Savage Strike', description: 'Heavy damage boosted by stacked Strength — becomes lethal by turn 5-6', turnEstimate: 5 },
      { name: 'Gore', description: 'Multi-hit attack — each hit boosted by Strength stacks' },
    ],
    counterAdvice: 'Front-load damage to end the fight before Strength stacks become lethal. Early burst archetypes excel. Poison auto-scales over time — even moderate stacks keep up with the Strength escalation.',
    countersArchetypes: ['strength-scaling', 'poison'],
    weakArchetypes: ['block-turtle', 'orb-focus'],
    needsAoe: false,
    needsScaling: true,
    needsBlock: false,
  },
  {
    aliases: ['kin priest', 'the kin priest'],
    threatMoves: [
      { name: 'Blessing', description: 'Buffs self and heals — must be interrupted by killing quickly' },
      { name: 'Smite', description: 'High damage attack targeting player repeatedly' },
      { name: 'Holy Wrath', description: 'Massive damage spike — offensive pressure prevents this move', turnEstimate: 4 },
    ],
    counterAdvice: 'Aggression is the answer — the Kin Priest rewards front-loaded damage. The longer the fight goes the more it heals and buffs. Any strong offensive archetype works; avoid passive or ramp strategies.',
    countersArchetypes: ['strength-scaling', 'poison', 'shiv', 'orb-focus'],
    weakArchetypes: ['block-turtle'],
    needsAoe: false,
    needsScaling: false,
    needsBlock: false,
  },
  {
    aliases: ['soul fysh', 'the soul fysh'],
    threatMoves: [
      { name: 'Beckon', description: 'Applies Beckon status — deals unblockable damage that cannot be prevented with Block', turnEstimate: 2 },
      { name: 'Lure', description: 'Draws player in, dealing damage and applying Vulnerable' },
      { name: 'Devour', description: 'Massive unblockable hit — turn 3 burst window must be used before this', turnEstimate: 3 },
    ],
    counterAdvice: 'Turns 2-3 are your burst windows before Beckon-sourced unblockable damage ramps. Block has limited value — kill it fast. Poison applied early denies the Devour turn effectively.',
    countersArchetypes: ['poison', 'orb-focus', 'strength-scaling'],
    weakArchetypes: ['block-turtle'],
    needsAoe: false,
    needsScaling: false,
    needsBlock: false,
  },
  {
    aliases: ['knowledge demon', 'the knowledge demon'],
    threatMoves: [
      { name: 'Siphon Knowledge', description: 'Heals based on cards played — stall play backfires badly' },
      { name: 'Curse Infusion', description: 'Adds a debuff choice — 3rd debuff becomes game-ending; kill before it fires', turnEstimate: 3 },
      { name: 'Arcane Bolt', description: 'Moderate damage with buff to its own Strength' },
    ],
    counterAdvice: 'Race the 3rd Curse Infusion — kill the Knowledge Demon before it lands. Stalling heals it via Siphon Knowledge. Strength-scaling decks with early burst win cleanly.',
    countersArchetypes: ['strength-scaling', 'exhaust'],
    weakArchetypes: ['block-turtle', 'draw-engine'],
    needsAoe: false,
    needsScaling: true,
    needsBlock: false,
  },
  {
    aliases: ['the insatiable', 'insatiable'],
    threatMoves: [
      { name: 'Sandpit', description: 'Activates a 4-5 turn kill timer — deck must win before the counter expires', turnEstimate: 5 },
      { name: 'Consume', description: 'Drains max HP each turn — scaling damage that cannot be outhealed' },
      { name: 'Hungering Strike', description: 'High damage combined with Consume — HP is a melting resource' },
    ],
    counterAdvice: 'You have 4-5 turns to win before the Sandpit kills you. Scaling decks that reach full power fast thrive here. Poison is an automatic win if stacked high enough by turn 2-3.',
    countersArchetypes: ['poison', 'strength-scaling'],
    weakArchetypes: ['block-turtle', 'draw-engine'],
    needsAoe: false,
    needsScaling: true,
    needsBlock: false,
  },
  {
    aliases: ['kaiser crab', 'the kaiser crab'],
    threatMoves: [
      { name: 'Shell Up', description: 'Stacks massive Armor (physical block) each turn — only Poison bypasses it' },
      { name: 'Claw Snap', description: 'Heavy physical attack after armor stacks are built' },
      { name: 'Fortify', description: 'Doubles current Armor — fight becomes unwinnable without poison if allowed', turnEstimate: 4 },
    ],
    counterAdvice: 'Poison bypasses armor — apply early and let it tick. Non-poison decks must burst through before Fortify doubles the armor stack. Strength-scaling with high burst can race the armor if started immediately.',
    countersArchetypes: ['poison'],
    weakArchetypes: ['block-turtle', 'exhaust', 'orb-focus'],
    needsAoe: false,
    needsScaling: true,
    needsBlock: false,
  },
  {
    aliases: ['the queen', 'queen'],
    threatMoves: [
      { name: 'Royal Decree', description: 'Phase 1 — stacks buffs and debuffs, sets up the hardest phases' },
      { name: 'Sovereign Command', description: 'Phase 2 — heavy sustained damage with multiple status effects' },
      { name: 'Final Judgment', description: 'Phase 3 — near-lethal hit; enter phase 3 with full block and high HP', turnEstimate: 10 },
    ],
    counterAdvice: 'Three-phase fight — the hardest encounter in the game. You need sustained damage across all three phases AND block for the Final Judgment spike. Prepare both offense and defense. No shortcut strategy exists; deck must be complete.',
    countersArchetypes: ['poison', 'strength-scaling'],
    weakArchetypes: ['exhaust', 'shiv'],
    needsAoe: false,
    needsScaling: true,
    needsBlock: true,
  },
]

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
}

function findBossEntry(bossName: string): BossEntry | null {
  const normalized = normalizeName(bossName)
  // Use exact match or whole-word containment to avoid false positives
  // (e.g. "nob" should not match "necrobinder")
  return BOSS_DATA.find(b =>
    b.aliases.some(a => {
      if (normalized === a) return true
      // Whole-word check: alias appears as a standalone word sequence in the name
      const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(normalized)
    })
  ) ?? null
}

/** Estimate how well the current deck handles the boss (1-10) */
function scoreDeckReadiness(
  entry: BossEntry,
  archetype: DeckArchetype,
  deck: GameCard[],
  relics: GameRelic[],
): number {
  let score = 5

  // Archetype fit
  if (entry.countersArchetypes.includes(archetype.primary)) score += 2
  if (entry.weakArchetypes.includes(archetype.primary)) score -= 2

  // Check deck for AoE if needed
  if (entry.needsAoe) {
    const hasAoe = deck.some(c =>
      (c.target_type === 'AllEnemy') ||
      (c.description?.toLowerCase().includes('all enemies'))
    )
    if (!hasAoe) score -= 1.5
  }

  // Check deck for scaling if needed
  if (entry.needsScaling) {
    const hasScaling = deck.some(c =>
      c.description?.toLowerCase().includes('strength') ||
      c.description?.toLowerCase().includes('dexterity') ||
      c.description?.toLowerCase().includes('poison')
    ) || relics.some(r =>
      r.description?.toLowerCase().includes('strength') ||
      r.name.toLowerCase().includes('pen nib')
    )
    if (!hasScaling) score -= 1
  }

  // Block readiness
  if (entry.needsBlock) {
    const hasBlock = deck.some(c =>
      c.description?.toLowerCase().includes('block') && c.type === 'Skill'
    )
    if (!hasBlock) score -= 1
  }

  return Math.max(1, Math.min(10, score))
}

/** Build a list of what the deck is missing for this boss fight */
function getMissingPieces(entry: BossEntry, deck: GameCard[], relics: GameRelic[]): string[] {
  const missing: string[] = []

  if (entry.needsAoe) {
    const hasAoe = deck.some(c =>
      c.target_type === 'AllEnemy' || c.description?.toLowerCase().includes('all enemies')
    )
    if (!hasAoe) missing.push('AoE damage (this boss needs multi-target coverage)')
  }

  if (entry.needsScaling) {
    const hasScaling = deck.some(c =>
      c.description?.toLowerCase().includes('strength') ||
      c.description?.toLowerCase().includes('dexterity')
    )
    if (!hasScaling) missing.push('Damage scaling (Strength / Dexterity / Poison source)')
  }

  if (entry.needsBlock) {
    const blockCards = deck.filter(c =>
      c.description?.toLowerCase().includes('block') && c.type === 'Skill'
    )
    if (blockCards.length < 3) missing.push('Block generation for the boss spike turns')
  }

  return missing
}

export function getBossContext(
  bossName: string,
  deck: GameCard[],
  relics: GameRelic[],
  archetype: DeckArchetype,
): BossContext | null {
  const entry = findBossEntry(bossName)
  if (!entry) return null

  return {
    bossName,
    threatMoves: entry.threatMoves,
    counterAdvice: entry.counterAdvice,
    deckReadiness: scoreDeckReadiness(entry, archetype, deck, relics),
    missingPieces: getMissingPieces(entry, deck, relics),
  }
}

/** Check whether a boss is within `lookahead` nodes on the map */
export function isBossImminent(floor: number, actBossFloor: number, lookahead = NEAR_BOSS_LOOKAHEAD): boolean {
  return floor >= actBossFloor - lookahead
}

/** Estimate boss floor for a given act (STS2 acts are ~17 floors each) */
export function estimateBossFloor(act: number): number {
  return act * FLOORS_PER_ACT
}
