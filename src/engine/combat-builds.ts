import type { CombatBuildLensId, CombatBuildLensOption, DeckArchetype } from '@/types/advisor'
import type { PlayerState } from '@/types/game-state'

export interface CombatBuildProfile {
  id: CombatBuildLensId
  label: string
  tagWeights: Partial<Record<string, number>>
}

const BUILD_OPTIONS_BY_CLASS: Record<string, CombatBuildLensOption[]> = {
  ironclad: [
    { id: 'auto', label: 'Auto' },
    { id: 'strength', label: 'Strength' },
    { id: 'exhaust', label: 'Exhaust' },
    { id: 'block', label: 'Block' },
  ],
  silent: [
    { id: 'auto', label: 'Auto' },
    { id: 'poison', label: 'Poison' },
    { id: 'shiv', label: 'Shiv' },
    { id: 'discard', label: 'Discard' },
  ],
  defect: [
    { id: 'auto', label: 'Auto' },
    { id: 'orb-focus', label: 'Orb Focus' },
    { id: 'frost-control', label: 'Frost Control' },
    { id: 'lightning-tempo', label: 'Lightning Tempo' },
  ],
  regent: [
    { id: 'auto', label: 'Auto' },
    { id: 'star-economy', label: 'Star Economy' },
    { id: 'creation-forging', label: 'Creation/Forging' },
    { id: 'skill-tempo', label: 'Skill Tempo' },
  ],
  necrobinder: [
    { id: 'auto', label: 'Auto' },
    { id: 'osty-aggro', label: 'Osty Aggro' },
    { id: 'doom-debuff', label: 'Doom/Debuff' },
    { id: 'ethereal-tempo', label: 'Ethereal Tempo' },
  ],
}

const DEFAULT_PROFILE: CombatBuildProfile = {
  id: 'auto',
  label: 'Auto',
  tagWeights: {
    attack: 1,
    block: 1,
    draw: 1,
    energy: 1,
    setup: 0.8,
    scaling: 0.9,
  },
}

const BUILD_PROFILES: Record<Exclude<CombatBuildLensId, 'auto'>, CombatBuildProfile> = {
  strength: {
    id: 'strength',
    label: 'Strength',
    tagWeights: { attack: 2.2, strength: 3.5, multiHit: 2.8, burst: 1.8, scaling: 1.8 },
  },
  exhaust: {
    id: 'exhaust',
    label: 'Exhaust',
    tagWeights: { exhaust: 3.4, payoff: 2.4, draw: 1.6, energy: 1.4, block: 1.2 },
  },
  block: {
    id: 'block',
    label: 'Block',
    tagWeights: { block: 3.5, weak: 1.8, vulnerable: 1.1, attack: 0.8, scaling: 1.1 },
  },
  poison: {
    id: 'poison',
    label: 'Poison',
    tagWeights: { poison: 4.2, setup: 2.2, payoff: 2.4, draw: 1.5, block: 0.9 },
  },
  shiv: {
    id: 'shiv',
    label: 'Shiv',
    tagWeights: { shiv: 4, attack: 2.6, multiHit: 3.1, strength: 1.8, payoff: 1.4 },
  },
  discard: {
    id: 'discard',
    label: 'Discard',
    tagWeights: { discard: 4, draw: 2.8, energy: 2.1, payoff: 2, attack: 1.1 },
  },
  'orb-focus': {
    id: 'orb-focus',
    label: 'Orb Focus',
    tagWeights: { orb: 3.2, focus: 4, lightning: 2, frost: 1.8, scaling: 2 },
  },
  'frost-control': {
    id: 'frost-control',
    label: 'Frost Control',
    tagWeights: { frost: 4, block: 2.4, orb: 2.2, focus: 1.8, weak: 1.2 },
  },
  'lightning-tempo': {
    id: 'lightning-tempo',
    label: 'Lightning Tempo',
    tagWeights: { lightning: 4.2, orb: 2.8, burst: 1.8, attack: 1.4, focus: 1.5 },
  },
  'star-economy': {
    id: 'star-economy',
    label: 'Star Economy',
    tagWeights: { star: 4.4, energy: 1.6, retain: 1.6, setup: 1.5, payoff: 1.8 },
  },
  'creation-forging': {
    id: 'creation-forging',
    label: 'Creation/Forging',
    tagWeights: { creation: 4, forge: 4, skill: 1.4, setup: 1.7, scaling: 1.6 },
  },
  'skill-tempo': {
    id: 'skill-tempo',
    label: 'Skill Tempo',
    tagWeights: { skill: 3.6, draw: 2.1, block: 1.8, energy: 1.5, setup: 1.4 },
  },
  'osty-aggro': {
    id: 'osty-aggro',
    label: 'Osty Aggro',
    tagWeights: { summon: 4, attack: 2.2, payoff: 2.4, burst: 1.6, draw: 1.2 },
  },
  'doom-debuff': {
    id: 'doom-debuff',
    label: 'Doom/Debuff',
    tagWeights: { doom: 4.1, weak: 2.1, vulnerable: 2.1, debuff: 2.4, poison: 1.3 },
  },
  'ethereal-tempo': {
    id: 'ethereal-tempo',
    label: 'Ethereal Tempo',
    tagWeights: { ethereal: 4.2, exhaust: 2.1, draw: 1.6, burst: 1.7, setup: 1.2 },
  },
}

export function normalizeCharacterId(character: string | null | undefined): string {
  const value = (character ?? '').toLowerCase()
  if (value.includes('ironclad')) return 'ironclad'
  if (value.includes('silent')) return 'silent'
  if (value.includes('defect')) return 'defect'
  if (value.includes('regent')) return 'regent'
  if (value.includes('necrobinder')) return 'necrobinder'
  return 'unknown'
}

export function getCombatBuildOptions(characterId: string): CombatBuildLensOption[] {
  return BUILD_OPTIONS_BY_CLASS[characterId] ?? [{ id: 'auto', label: 'Auto' }]
}

export function getCombatBuildProfile(buildId: CombatBuildLensId): CombatBuildProfile {
  if (buildId === 'auto') return DEFAULT_PROFILE
  return BUILD_PROFILES[buildId]
}

export function resolveAutoBuildLens(
  characterId: string,
  archetype: DeckArchetype | undefined,
  player: Pick<PlayerState, 'hand' | 'status' | 'relics' | 'orbs' | 'stars' | 'pets'>,
): CombatBuildLensId {
  const cards = player.hand ?? []
  // Use explicit name sets for precision — avoids false positives from text blob matching
  const cardNames = new Set(cards.map(c => c.name.toLowerCase()))
  const relicNames = new Set((player.relics ?? []).map(r => r.name.toLowerCase()))
  const statusIds = new Set((player.status ?? []).map(p => (p.id ?? p.name ?? '').toLowerCase()))

  switch (characterId) {
    case 'ironclad': {
      const strengthCards = ['limit break', 'inflame', 'demon form', 'flex', 'spot weakness', 'battle hymn', 'twin strike']
      const strengthRelics = ['paper crane', 'dumbell', 'champion belt']
      const exhaustCards = ['corruption', 'feel no pain', 'dark embrace', 'warcry', 'sentinel', 'exhaust']
      const hasStrength = strengthCards.some(n => cardNames.has(n))
        || strengthRelics.some(n => relicNames.has(n))
        || statusIds.has('strength')
        || archetype?.primary === 'strength-scaling'
      const hasExhaust = exhaustCards.some(n => cardNames.has(n))
        || archetype?.primary === 'exhaust'
      if (hasStrength) return 'strength'
      if (hasExhaust) return 'exhaust'
      return 'block'
    }
    case 'silent': {
      const poisonCards = ['deadly poison', 'noxious fumes', 'catalyst', 'bouncing flask', 'corpse explosion', 'envenom', 'crippling cloud']
      const shivCards = ['accuracy', 'blade dance', 'cloak and dagger', 'thousand cuts', 'infinite blades', 'after image']
      const discardCards = ['wraith form', 'tactician', 'reflex', 'acrobatics', 'prepared', 'survivor', 'heel hook']
      const hasPoison = poisonCards.some(n => cardNames.has(n))
        || archetype?.primary === 'poison'
      const hasShiv = shivCards.some(n => cardNames.has(n))
        || cardNames.has('shiv')
        || archetype?.primary === 'shiv'
      const hasDiscard = discardCards.some(n => cardNames.has(n))
        || archetype?.primary === 'discard'
      if (hasPoison) return 'poison'
      if (hasShiv) return 'shiv'
      if (hasDiscard) return 'discard'
      return 'discard'
    }
    case 'defect': {
      const frostCards = ['glacier', 'cold snap', 'chill', 'blizzard', 'leap', 'doom and gloom']
      const lightningCards = ['ball lightning', 'electrodynamics', 'thunder strike', 'fission', 'doom and gloom']
      const focusCards = ['defragment', 'consume', 'reprogram', 'capacitor']
      // Relic-based lens overrides for Defect
      const frostRelics = ['frozen eye', 'calipers']          // frost-control relics
      const lightningRelics = ['electrodynamics', 'runic capacitor', 'inserter']  // lightning relics
      const orbRelics = ['nuclear battery', 'data disk', 'emotion chip']          // generic orb power
      const hasFrost = frostCards.some(n => cardNames.has(n)) || frostRelics.some(n => relicNames.has(n))
      const hasLightning = lightningCards.some(n => cardNames.has(n)) || lightningRelics.some(n => relicNames.has(n))
      const hasFocus = focusCards.some(n => cardNames.has(n)) || orbRelics.some(n => relicNames.has(n))
        || archetype?.primary === 'orb-focus'
      if (hasFrost && !hasLightning) return 'frost-control'
      if (hasLightning && !hasFrost) return 'lightning-tempo'
      if (hasFocus) return 'orb-focus'
      if (hasFrost) return 'frost-control'
      if (hasLightning) return 'lightning-tempo'
      return 'orb-focus'
    }
    case 'regent': {
      const starCards = ['windmill strike', 'eruption', 'reach heaven', 'consecrate']
      const forgeCards = ['forge', 'masterwork weapon', 'creation']
      if ((player.stars ?? 0) > 0 || starCards.some(n => cardNames.has(n)) || archetype?.primary === 'star-engine') return 'star-economy'
      if (forgeCards.some(n => cardNames.has(n))) return 'creation-forging'
      return 'skill-tempo'
    }
    case 'necrobinder': {
      const ostyCards = ['raise dead', 'command', 'haunt', 'animate']
      const doomCards = ['doom', 'curse', 'hex', 'afflict', 'torment']
      const hasPets = (player.pets?.length ?? 0) > 0
      const hasOsty = ostyCards.some(n => cardNames.has(n))
      const hasDoom = doomCards.some(n => cardNames.has(n))
      if (hasPets || hasOsty) return 'osty-aggro'
      if (hasDoom) return 'doom-debuff'
      return 'ethereal-tempo'
    }
    default:
      if (archetype?.primary === 'poison') return 'poison'
      if (archetype?.primary === 'shiv') return 'shiv'
      if (archetype?.primary === 'discard') return 'discard'
      if (archetype?.primary === 'orb-focus') return 'orb-focus'
      if (archetype?.primary === 'exhaust') return 'exhaust'
      if (archetype?.primary === 'strength-scaling') return 'strength'
      return 'auto'
  }
}
