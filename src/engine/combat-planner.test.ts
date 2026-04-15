import { beforeEach, describe, expect, it } from 'vitest'
import { analyzeCombat } from './combat-analyzer'
import type { CodexCard, CodexData, CodexPotion, CodexRelic } from '@/types/codex'
import type { DeckArchetype } from '@/types/advisor'
import type { GameCard, GamePotion, GameRelic, GameState, PlayerState } from '@/types/game-state'

function makeCodexCard(overrides: Partial<CodexCard> & Pick<CodexCard, 'id' | 'name'>): CodexCard {
  return {
    id: overrides.id,
    name: overrides.name,
    description: overrides.description ?? '',
    description_raw: overrides.description_raw ?? null,
    cost: overrides.cost ?? 1,
    is_x_cost: overrides.is_x_cost ?? false,
    is_x_star_cost: overrides.is_x_star_cost ?? false,
    star_cost: overrides.star_cost ?? null,
    type: overrides.type ?? 'Attack',
    type_key: overrides.type_key ?? null,
    rarity: overrides.rarity ?? 'Common',
    rarity_key: overrides.rarity_key ?? null,
    target: overrides.target ?? 'AnyEnemy',
    color: overrides.color ?? 'Test',
    damage: overrides.damage ?? null,
    block: overrides.block ?? null,
    hit_count: overrides.hit_count ?? null,
    powers_applied: overrides.powers_applied ?? null,
    cards_draw: overrides.cards_draw ?? null,
    energy_gain: overrides.energy_gain ?? null,
    hp_loss: overrides.hp_loss ?? null,
    keywords: overrides.keywords ?? null,
    keywords_key: overrides.keywords_key ?? null,
    tags: overrides.tags ?? null,
    spawns_cards: overrides.spawns_cards ?? null,
    vars: overrides.vars ?? null,
    upgrade: overrides.upgrade ?? null,
    upgrade_description: overrides.upgrade_description ?? null,
    image_url: overrides.image_url ?? null,
    compendium_order: overrides.compendium_order ?? 0,
  }
}

function makeCodexPotion(overrides: Partial<CodexPotion> & Pick<CodexPotion, 'id' | 'name'>): CodexPotion {
  return {
    id: overrides.id,
    name: overrides.name,
    description: overrides.description ?? '',
    description_raw: overrides.description_raw ?? null,
    rarity: overrides.rarity ?? 'Common',
    rarity_key: overrides.rarity_key ?? null,
    pool: overrides.pool ?? null,
    image_url: overrides.image_url ?? null,
    compendium_order: overrides.compendium_order ?? 0,
  }
}

function createCodex(cards: CodexCard[], potions: CodexPotion[] = [], relics: CodexRelic[] = []): CodexData {
  return {
    cards,
    relics,
    potions,
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
    cardById: new Map(cards.map(card => [card.id, card])),
    cardByName: new Map(cards.map(card => [card.name.toLowerCase(), card])),
    relicById: new Map(relics.map(relic => [relic.id, relic])),
    relicByName: new Map(relics.map(relic => [relic.name.toLowerCase(), relic])),
    monsterById: new Map(),
    eventById: new Map(),
    encounterById: new Map(),
    powerById: new Map(),
    potionById: new Map(potions.map(potion => [potion.id, potion])),
    potionByName: new Map(potions.map(potion => [potion.name.toLowerCase(), potion])),
    ancientById: new Map(),
  }
}

function makeGameCard(overrides: Partial<GameCard> & Pick<GameCard, 'id' | 'name'>): GameCard {
  return {
    id: overrides.id,
    name: overrides.name,
    cost: overrides.cost ?? 1,
    type: overrides.type ?? 'Attack',
    rarity: overrides.rarity ?? 'Common',
    description: overrides.description ?? '',
    keywords: overrides.keywords ?? [],
    index: overrides.index ?? 0,
    target_type: overrides.target_type ?? 'AnyEnemy',
    can_play: overrides.can_play ?? true,
  }
}

function makeState({
  player,
  hand,
  enemyHp,
  enemyIntentLabel = '0',
  potions = [],
  relics = [],
}: {
  player?: Partial<PlayerState>
  hand: GameCard[]
  enemyHp: number
  enemyIntentLabel?: string
  potions?: GamePotion[]
  relics?: GameRelic[]
}): GameState {
  return {
    state_type: 'monster',
    run: { act: 1, floor: 1, seed: 'seed' },
    player: {
      character: player?.character ?? 'Silent',
      hp: player?.hp ?? 40,
      max_hp: player?.max_hp ?? 40,
      block: player?.block ?? 0,
      energy: player?.energy ?? 1,
      max_energy: player?.max_energy ?? 3,
      gold: player?.gold ?? 99,
      stars: player?.stars ?? 0,
      hand,
      draw_pile: player?.draw_pile ?? [],
      discard_pile: player?.discard_pile ?? [],
      exhaust_pile: player?.exhaust_pile ?? [],
      draw_pile_count: player?.draw_pile_count ?? 0,
      discard_pile_count: player?.discard_pile_count ?? 0,
      exhaust_pile_count: player?.exhaust_pile_count ?? 0,
      orbs: player?.orbs ?? [],
      orb_slots: player?.orb_slots ?? 0,
      orb_empty_slots: player?.orb_empty_slots ?? 0,
      pets: player?.pets ?? [],
      status: player?.status ?? [],
      relics,
      potions,
    },
    battle: {
      round: 1,
      turn: 'player',
      is_play_phase: true,
      enemies: [{
        entity_id: 'test-enemy',
        combat_id: 1,
        name: 'Test Enemy',
        hp: enemyHp,
        max_hp: enemyHp,
        block: 0,
        status: [],
        intents: [{
          type: 'Attack',
          label: enemyIntentLabel,
          title: 'Attack',
          description: `Attack for ${enemyIntentLabel} damage`,
        }],
      }],
    },
  }
}

const BALANCED_ARCHETYPE: DeckArchetype = {
  primary: 'balanced',
  secondary: null,
  confidence: 1,
  label: 'Balanced',
}

describe('combat planner', () => {
  beforeEach(() => {
    // no shared planner state expected
  })

  it('prioritizes a lethal line over slower setup', () => {
    const codex = createCodex([
      makeCodexCard({ id: 'big-hit', name: 'Big Hit', damage: 10, cost: 1, type: 'Attack' }),
      makeCodexCard({
        id: 'deadly-poison',
        name: 'Deadly Poison',
        cost: 1,
        type: 'Skill',
        powers_applied: [{ power: 'Poison', power_key: 'poison', amount: 6 }],
        keywords: ['Poison'],
      }),
    ])

    const state = makeState({
      enemyHp: 10,
      hand: [
        makeGameCard({ id: 'deadly-poison', name: 'Deadly Poison', cost: 1, type: 'Skill' }),
        makeGameCard({ id: 'big-hit', name: 'Big Hit', cost: 1, type: 'Attack' }),
      ],
    })

    const advice = analyzeCombat(state, codex, BALANCED_ARCHETYPE, { selectedBuildLensId: 'auto' })

    expect(advice?.candidateLines[0].steps.map(step => step.label)).toEqual(['Big Hit'])
    expect(advice?.suggestedPlay[0].reason.toLowerCase()).toContain('lethal')
  })

  it('prefers a survival line over greedy damage when death is otherwise imminent', () => {
    const codex = createCodex([
      makeCodexCard({ id: 'defend', name: 'Defend', block: 12, cost: 1, type: 'Skill' }),
      makeCodexCard({ id: 'strike', name: 'Strike', damage: 10, cost: 1, type: 'Attack' }),
    ])

    const state = makeState({
      enemyHp: 30,
      enemyIntentLabel: '18',
      hand: [
        makeGameCard({ id: 'strike', name: 'Strike', cost: 1, type: 'Attack' }),
        makeGameCard({ id: 'defend', name: 'Defend', cost: 1, type: 'Skill' }),
      ],
      player: { hp: 12, energy: 1 },
    })

    const advice = analyzeCombat(state, codex, BALANCED_ARCHETYPE, { selectedBuildLensId: 'auto' })

    expect(advice?.candidateLines[0].steps[0].label).toBe('Defend')
    expect(advice?.summary.toLowerCase()).toContain('survive')
  })

  it('changes the top line when the build lens changes', () => {
    const codex = createCodex([
      makeCodexCard({
        id: 'deadly-poison',
        name: 'Deadly Poison',
        cost: 1,
        type: 'Skill',
        powers_applied: [{ power: 'Poison', power_key: 'poison', amount: 6 }],
        keywords: ['Poison'],
      }),
      makeCodexCard({
        id: 'blade-dance',
        name: 'Blade Dance',
        cost: 1,
        type: 'Attack',
        damage: 9,
        hit_count: 3,
        keywords: ['Shiv'],
        tags: ['shiv'],
      }),
    ])

    const state = makeState({
      enemyHp: 40,
      hand: [
        makeGameCard({ id: 'deadly-poison', name: 'Deadly Poison', cost: 1, type: 'Skill' }),
        makeGameCard({ id: 'blade-dance', name: 'Blade Dance', cost: 1, type: 'Attack' }),
      ],
      player: { character: 'Silent', energy: 1 },
    })

    const poisonAdvice = analyzeCombat(state, codex, BALANCED_ARCHETYPE, { selectedBuildLensId: 'poison' })
    const shivAdvice = analyzeCombat(state, codex, BALANCED_ARCHETYPE, { selectedBuildLensId: 'shiv' })

    expect(poisonAdvice?.candidateLines[0].steps[0].label).toBe('Deadly Poison')
    expect(shivAdvice?.candidateLines[0].steps[0].label).toBe('Blade Dance')
  })

  it('treats defensive potions as first-class survival actions', () => {
    const codex = createCodex(
      [makeCodexCard({ id: 'strike', name: 'Strike', damage: 8, cost: 1, type: 'Attack' })],
      [makeCodexPotion({ id: 'block-potion', name: 'Block Potion', description: 'Gain 12 Block.' })],
    )

    const state = makeState({
      enemyHp: 30,
      enemyIntentLabel: '12',
      hand: [makeGameCard({ id: 'strike', name: 'Strike', cost: 1, type: 'Attack' })],
      potions: [{ id: 'block-potion', name: 'Block Potion', slot: 0 }],
      player: { hp: 6, energy: 1 },
    })

    const advice = analyzeCombat(state, codex, BALANCED_ARCHETYPE, { selectedBuildLensId: 'auto' })

    expect(advice?.candidateLines[0].steps[0].type).toBe('potion')
    expect(advice?.potionSuggestion).toContain('Block Potion')
  })
})
