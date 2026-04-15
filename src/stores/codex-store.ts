import { create } from 'zustand'
import type { CodexData, CodexCard, CodexRelic, CodexMonster, CodexEvent, CodexEncounter, CodexPower, CodexPotion, CodexAncient } from '@/types/codex'

interface CodexStore {
  data: CodexData | null
  isLoading: boolean
  error: string | null
  setData: (raw: Record<string, unknown>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

function buildLookupMaps(raw: Record<string, unknown>): CodexData {
  const cards = (raw.cards as CodexCard[]) ?? []
  const relics = (raw.relics as CodexRelic[]) ?? []
  const monsters = (raw.monsters as CodexMonster[]) ?? []
  const events = (raw.events as CodexEvent[]) ?? []
  const encounters = (raw.encounters as CodexEncounter[]) ?? []
  const powers = (raw.powers as CodexPower[]) ?? []
  const potions = (raw.potions as CodexPotion[]) ?? []
  const ancients = (raw['ancient-pools'] as CodexAncient[]) ?? []

  return {
    cards,
    relics,
    potions,
    monsters,
    powers,
    encounters,
    events,
    keywords: (raw.keywords as CodexData['keywords']) ?? [],
    enchantments: (raw.enchantments as CodexData['enchantments']) ?? [],
    orbs: (raw.orbs as CodexData['orbs']) ?? [],
    afflictions: (raw.afflictions as CodexData['afflictions']) ?? [],
    'ancient-pools': ancients,
    acts: (raw.acts as CodexData['acts']) ?? [],
    ascensions: (raw.ascensions as CodexData['ascensions']) ?? [],
    characters: (raw.characters as CodexData['characters']) ?? [],
    epochs: (raw.epochs as CodexData['epochs']) ?? [],
    cardById: new Map(cards.map(c => [c.id, c])),
    cardByName: new Map(cards.map(c => [c.name.toLowerCase(), c])),
    relicById: new Map(relics.map(r => [r.id, r])),
    relicByName: new Map(relics.map(r => [r.name.toLowerCase(), r])),
    potionById: new Map(potions.map(p => [p.id, p])),
    potionByName: new Map(potions.map(p => [p.name.toLowerCase(), p])),
    monsterById: new Map(monsters.map(m => [m.id, m])),
    eventById: new Map(events.map(e => [e.id, e])),
    encounterById: new Map(encounters.map(e => [e.id, e])),
    powerById: new Map(powers.map(p => [p.id, p])),
    ancientById: new Map(ancients.map(a => [a.id, a])),
  }
}

export const useCodexStore = create<CodexStore>((set) => ({
  data: null,
  isLoading: false,
  error: null,
  setData: (raw) => set({ data: buildLookupMaps(raw), isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),
}))
