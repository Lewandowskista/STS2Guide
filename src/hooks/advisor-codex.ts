import type { CodexData } from '@/types/codex'
import type { ActiveContext } from '@/utils/context-resolution'

let emptyCodexData: CodexData | null = null

export function buildEmptyCodexData(): CodexData {
  return {
    cards: [],
    relics: [],
    potions: [],
    monsters: [],
    powers: [],
    encounters: [],
    events: [],
    keywords: [],
    enchantments: [],
    orbs: [],
    afflictions: [],
    'ancient-pools': [],
    acts: [],
    ascensions: [],
    characters: [],
    epochs: [],
    cardById: new Map(),
    cardByName: new Map(),
    relicById: new Map(),
    relicByName: new Map(),
    monsterById: new Map(),
    eventById: new Map(),
    encounterById: new Map(),
    powerById: new Map(),
    potionById: new Map(),
    potionByName: new Map(),
    ancientById: new Map(),
  }
}

export function getEmptyCodexData(): CodexData {
  emptyCodexData ??= buildEmptyCodexData()
  return emptyCodexData
}

export function resolveAdvisorCodex(codex: CodexData | null, _activeContext: ActiveContext): CodexData | null {
  if (codex) return codex
  // Always fall back to empty codex so all panels can render while the full codex loads.
  // Codex-heavy evaluators (card_reward, shop, relic_select, event) will silently produce
  // no ratings when the maps are empty, which is better than blocking all panels entirely.
  return getEmptyCodexData()
}
