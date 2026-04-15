import type { GameCard } from '@/types/game-state'
import type { DeckArchetype } from '@/types/advisor'

export interface MetaBuild {
  id: string
  name: string
  characterId: string        // 'ironclad' | 'silent' | 'defect' | 'regent' | 'necrobinder'
  archetypeId: string        // maps to ArchetypeId
  coreCards: string[]        // card names — must-haves; large score boost when missing
  synergyCards: string[]     // supporting cards; smaller boost
  keyRelics: string[]        // relic names that define the build
  winCondition: string
}

export const META_BUILDS: MetaBuild[] = [
  // ── Ironclad ──────────────────────────────────────────────────────────────
  {
    id: 'ironclad-strength',
    name: 'Strength Scaling',
    characterId: 'ironclad',
    archetypeId: 'strength-scaling',
    coreCards: ['Demon Form', 'Inflame', 'Whirlwind'],
    synergyCards: ['Spot Weakness', 'Limit Break', 'Heavy Blade', 'Flex'],
    keyRelics: ['Vajra', 'Paper Phrog'],
    winCondition: 'Stack Strength with Demon Form/Inflame then close with Whirlwind',
  },
  {
    id: 'ironclad-barricade',
    name: 'Barricade Block',
    characterId: 'ironclad',
    archetypeId: 'block-turtle',
    coreCards: ['Barricade', 'Entrench', 'Body Slam'],
    synergyCards: ['Impervious', 'Fortress', 'Iron Wave'],
    keyRelics: ['Calipers', 'Girya'],
    winCondition: 'Build infinite block with Barricade/Entrench then deal damage via Body Slam',
  },
  {
    id: 'ironclad-exhaust',
    name: 'Exhaust Engine',
    characterId: 'ironclad',
    archetypeId: 'exhaust',
    coreCards: ['Corruption', 'Dark Embrace', 'Feel No Pain'],
    synergyCards: ['Sentinel', 'Offering', 'Immolate'],
    keyRelics: ['Dead Branch', "Charon's Ashes"],
    winCondition: 'Exhaust deck to 0-cost skills, draw with Dark Embrace, gain block with Feel No Pain',
  },

  // ── Silent ────────────────────────────────────────────────────────────────
  {
    id: 'silent-shiv',
    name: 'Shiv Storm',
    characterId: 'silent',
    archetypeId: 'shiv',
    coreCards: ['Blade Dance', 'Accuracy', 'Infinite Blades'],
    synergyCards: ['Thousand Cuts', 'Cloak and Dagger', 'Quick Slash'],
    keyRelics: ['Kunai', 'Shuriken'],
    winCondition: 'Flood hand with Shivs amplified by Accuracy, close with Thousand Cuts',
  },
  {
    id: 'silent-poison',
    name: 'Poison Ramp',
    characterId: 'silent',
    archetypeId: 'poison',
    coreCards: ['Deadly Poison', 'Catalyst', 'Noxious Fumes'],
    synergyCards: ['Bouncing Flask', 'Corpse Explosion', 'Crippling Cloud'],
    keyRelics: ['Snecko Skull', 'Twisted Funnel'],
    winCondition: 'Stack Poison rapidly then double it with Catalyst for exponential damage',
  },
  {
    id: 'silent-discard',
    name: 'Discard/Sly',
    characterId: 'silent',
    archetypeId: 'discard',
    coreCards: ['Tactician', 'Reflex', 'Calculated Gamble'],
    synergyCards: ['Wraith Form', 'Sneaky Strike', 'Acrobatics'],
    keyRelics: ['Tingsha', 'Tough Bandages'],
    winCondition: 'Cycle discard triggers for energy/draw then burst from an empty hand',
  },

  // ── Defect ────────────────────────────────────────────────────────────────
  {
    id: 'defect-claw',
    name: 'Claw Build',
    characterId: 'defect',
    archetypeId: 'orb-focus',
    coreCards: ['Claw', 'All for One', 'Scrape'],
    synergyCards: ['Coolheaded', 'Defragment', 'Streamline'],
    keyRelics: ['Inserter', 'Data Disk'],
    winCondition: 'Play Claw repeatedly (+2 dmg per Claw played), then All for One replays them all',
  },
  {
    id: 'defect-lightning',
    name: 'Lightning Focus',
    characterId: 'defect',
    archetypeId: 'lightning-tempo',
    coreCards: ['Ball Lightning', 'Defragment', 'Electrodynamics'],
    synergyCards: ['Consume', 'Amplify', 'Thunder Strike'],
    keyRelics: ['Frozen Core', 'Cracked Core'],
    winCondition: 'Channel Lightning orbs, ramp Focus with Defragment, Electrodynamics to chain evokes',
  },
  {
    id: 'defect-frost',
    name: 'Frost Control',
    characterId: 'defect',
    archetypeId: 'frost-control',
    coreCards: ['Glacier', 'Coolheaded', 'Blizzard'],
    synergyCards: ['Biased Cognition', 'Defragment', 'Tempest'],
    keyRelics: ['Ice Cream', 'Frozen Eye'],
    winCondition: 'Stack Frost orbs for passive block each turn, dump with Blizzard for burst damage',
  },

  // ── Regent ────────────────────────────────────────────────────────────────
  {
    id: 'regent-stars',
    name: 'Star Engine',
    characterId: 'regent',
    archetypeId: 'star-engine',
    coreCards: ['Hidden Cache', 'Seven Stars'],
    synergyCards: ['Windmill Strike', 'Eruption', 'Reach Heaven'],
    keyRelics: ['Lunar Pastry'],
    winCondition: 'Generate Stars to fuel Seven Stars and close with Windmill Strike / Eruption combos',
  },
  {
    id: 'regent-forge',
    name: 'Forge Strike',
    characterId: 'regent',
    archetypeId: 'strength-scaling',
    coreCards: ['Sword Boomerang', 'Iron Wave', 'Pommel Strike'],
    synergyCards: ['Havoc', 'Uppercut', 'Clothesline'],
    keyRelics: ['Paper Phrog', 'Vajra'],
    winCondition: 'Upgrade multi-hit strikes and chain upgrades to snowball into the boss fight',
  },

  // ── Necrobinder ───────────────────────────────────────────────────────────
  {
    id: 'necrobinder-doom',
    name: 'Doom/Debuff',
    characterId: 'necrobinder',
    archetypeId: 'doom-debuff',
    coreCards: ['Blight Strike', 'Defile'],
    synergyCards: ['Writhe', 'Rupture', 'Curse of the Bell'],
    keyRelics: ['Cursed Tome'],
    winCondition: 'Apply Doom and stack debuffs with Defile to overwhelm enemies passively',
  },
  {
    id: 'necrobinder-osty',
    name: 'Osty/Summon',
    characterId: 'necrobinder',
    archetypeId: 'osty-aggro',
    coreCards: ['Pull Aggro', 'Reanimate'],
    synergyCards: ['Soul Strike', 'Echo Form', 'Spirit Shield'],
    keyRelics: ['Dead Branch', 'Sundial'],
    winCondition: 'Redirect damage to summons via Pull Aggro and recycle them with Reanimate',
  },
  {
    id: 'necrobinder-ethereal',
    name: 'Ethereal Tempo',
    characterId: 'necrobinder',
    archetypeId: 'ethereal-tempo',
    coreCards: ['Foresight', 'Wail'],
    synergyCards: ['Nightmare', 'Void', 'Phantasmal Killer'],
    keyRelics: ["Strange Spoon", "Nilry's Codex"],
    winCondition: 'Cycle Ethereal cards with Foresight to set up Wail/Nightmare burst turns',
  },
]

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BuildTarget {
  build: MetaBuild
  coreOwned: string[]      // core card names already in deck
  coreMissing: string[]    // core card names not yet in deck
  synergyOwned: string[]   // synergy card names already in deck
  completion: number       // 0–1, weighted: core cards count 2x, synergy 1x
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normalise card name for loose matching (case-insensitive, strips + suffix) */
function normName(name: string): string {
  return name.toLowerCase().replace(/\+\d*$/, '').trim()
}

function deckHasCard(deck: GameCard[], cardName: string): boolean {
  const target = normName(cardName)
  return deck.some(c => {
    const n = normName(c.name)
    return n === target || n.startsWith(target)
  })
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Given the current deck and character, return plausible meta build targets
 * sorted by completion (highest first). Only returns builds for the active character.
 *
 * A build is included if:
 *   - at least 1 core card is owned, OR
 *   - archetype matches AND completion >= 15%
 */
export function detectBuildTargets(
  deck: GameCard[],
  characterId: string,
  archetype: DeckArchetype,
): BuildTarget[] {
  const charKey = characterId.toLowerCase()
  const candidates = META_BUILDS.filter(b => b.characterId === charKey)

  return candidates
    .map((build): BuildTarget => {
      const coreOwned = build.coreCards.filter(c => deckHasCard(deck, c))
      const coreMissing = build.coreCards.filter(c => !deckHasCard(deck, c))
      const synergyOwned = build.synergyCards.filter(c => deckHasCard(deck, c))

      const totalWeight = build.coreCards.length * 2 + build.synergyCards.length
      const ownedWeight = coreOwned.length * 2 + synergyOwned.length
      const completion = totalWeight > 0 ? ownedWeight / totalWeight : 0

      return { build, coreOwned, coreMissing, synergyOwned, completion }
    })
    .filter(bt => {
      const archetypeMatch =
        bt.build.archetypeId === archetype.primary ||
        bt.build.archetypeId === archetype.secondary
      return bt.coreOwned.length >= 1 || (archetypeMatch && bt.completion >= 0.15)
    })
    .sort((a, b) => b.completion - a.completion)
    .slice(0, 2)
}

// ─── Card scoring helpers ────────────────────────────────────────────────────

/**
 * Returns the first build target for which `cardName` is a core card, or null.
 */
export function isCoreCardForTarget(cardName: string, targets: BuildTarget[]): MetaBuild | null {
  const norm = normName(cardName)
  for (const target of targets) {
    if (target.build.coreCards.some(c => normName(c) === norm)) return target.build
  }
  return null
}

/**
 * Score bonus for a card given active build targets.
 *
 * Priority:
 *   1. Core card not yet owned → +2.5 (highest — "must acquire")
 *   2. Core card already owned but build incomplete → +1.0 (pairs / copies)
 *   3. Synergy card not yet owned → +1.0
 *   4. No match → 0
 */
export function buildTargetBonus(
  cardName: string,
  targets: BuildTarget[],
): { bonus: number; reason: string | null; isCoreCard: boolean } {
  const norm = normName(cardName)
  for (const target of targets) {
    // Missing core
    if (target.coreMissing.some(c => normName(c) === norm)) {
      return {
        bonus: 2.5,
        reason: `Core card for ${target.build.name} — missing from your deck`,
        isCoreCard: true,
      }
    }
    // Owned core (build still incomplete — second copy may still help some builds)
    if (target.coreOwned.some(c => normName(c) === norm) && target.coreMissing.length > 0) {
      return {
        bonus: 1.0,
        reason: `Core card for ${target.build.name}`,
        isCoreCard: true,
      }
    }
    // Missing synergy
    if (
      target.build.synergyCards.some(c => normName(c) === norm) &&
      !target.synergyOwned.some(c => normName(c) === norm)
    ) {
      return {
        bonus: 1.0,
        reason: `Supports ${target.build.name}`,
        isCoreCard: false,
      }
    }
  }
  return { bonus: 0, reason: null, isCoreCard: false }
}
