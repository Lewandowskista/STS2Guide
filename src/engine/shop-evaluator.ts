import type { ShopItem, GameCard, GameRelic, ActivePower, PlayerState, MapNode } from '@/types/game-state'
import type { CodexData } from '@/types/codex'
import type { ShopItemEvaluation, DeckArchetype } from '@/types/advisor'
import { scoreToRating } from '@/types/advisor'
import { evaluateCard } from './card-evaluator'
import { evaluateRelics } from './relic-evaluator'
import { isBossImminent, estimateBossFloor } from './boss-advisor'
import type { BuildTarget } from './meta-builds'

/**
 * Override scores for specific high-value potions.
 * Rarity-based scoring (Rare=7.5, Uncommon=6.5, Common=5.5) is used as
 * the default, but some potions punch well above or below their rarity tier.
 */
const POTION_SCORES: Record<string, number> = {
  // Extremely high value
  'Fairy in a Bottle': 9.5,   // revive on death — nearly always worth buying
  'Entropic Brew': 8.5,       // fills all empty slots with random potions
  'Strength Potion': 8.0,     // +5 Strength for one fight — massive burst
  'Dexterity Potion': 7.5,    // +5 Dexterity — strong for block-heavy builds
  'Ancient Potion': 7.5,      // grants one Artifact stack — blocks next debuff
  // Above average
  'Energy Potion': 7.0,       // +2 energy this turn — enables large combos
  'Explosive Potion': 7.0,    // 10 damage to all — solid AoE tool
  'Duplication Potion': 7.0,  // plays next card twice — combo potential
  // Below average
  'Regen Potion': 5.0,        // regeneration heals slowly — often too slow
  'Block Potion': 5.5,        // 12 block for 1 turn — low combat impact
}

/** Find the weakest card in the deck to recommend for removal */
function findRemovalTarget(deck: GameCard[], codex: CodexData, archetype: DeckArchetype): string | null {
  if (deck.length === 0) return null

  // Priority order: curses > status > starters > low-synergy basics
  const curses = deck.filter(c => {
    const cx = c.id ? codex.cardById.get(c.id) : codex.cardByName?.get(c.name.toLowerCase())
    return cx?.type === 'Curse' || c.type === 'Curse'
  })
  if (curses.length > 0) return curses[0].name

  const statuses = deck.filter(c => {
    const cx = c.id ? codex.cardById.get(c.id) : codex.cardByName?.get(c.name.toLowerCase())
    return cx?.type === 'Status' || c.type === 'Status'
  })
  if (statuses.length > 0) return statuses[0].name

  // Starter cards (Strike, Defend variants)
  const starters = deck.filter(c => {
    const cx = c.id ? codex.cardById.get(c.id) : codex.cardByName?.get(c.name.toLowerCase())
    return cx?.rarity === 'Starter' || c.rarity === 'Starter'
  })
  if (starters.length > 0) {
    // Remove strike before defend in damage-focused archetypes; defend if block-focused
    if (archetype.primary === 'block-turtle') {
      const strike = starters.find(c => c.name.toLowerCase().includes('strike'))
      return strike?.name ?? starters[0].name
    }
    return starters[0].name
  }

  // Basic cards
  const basics = deck.filter(c => {
    const cx = c.id ? codex.cardById.get(c.id) : codex.cardByName?.get(c.name.toLowerCase())
    return cx?.rarity === 'Basic' || c.rarity === 'Basic'
  })
  if (basics.length > 0) return basics[0].name

  return null
}

export function evaluateShop(
  items: ShopItem[],
  player: PlayerState,
  codex: CodexData,
  archetype: DeckArchetype,
  act: number,
  floor: number,
  isFakeMerchant = false,
  nextOptions: MapNode[] = [],
  buildTargets?: BuildTarget[],
): ShopItemEvaluation[] {
  const deck = [
    ...(player.hand ?? []),
    ...(player.draw_pile ?? []),
    ...(player.discard_pile ?? []),
    ...(player.exhaust_pile ?? []),
  ]

  const relicCandidates = items
    .filter(i => (i.category ?? i.type) === 'relic')
    .map(i => {
      if (i.relic) return i.relic
      const rid = i.relic_id ?? i.id ?? ''
      const rname = i.relic_name ?? i.name ?? ''
      const idSlug = rid.toLowerCase().replace(/_/g, ' ')
      const nameLower = rname.toLowerCase()
      const cx = codex.relicById?.get(rid)
        ?? codex.relicByName?.get(idSlug)
        ?? codex.relicByName?.get(nameLower)
      return { id: rid, name: rname || cx?.name || '', description: i.relic_description ?? i.description ?? cx?.description } as import('@/types/game-state').GameRelic
    })
    .filter(r => r.name)

  const relicEvals = evaluateRelics(relicCandidates, deck, player.relics ?? [], codex, archetype, player.status ?? [], act)
  // Index by both id and lowercase name so lookup succeeds regardless of how the API sends the key
  const relicScoreMap = new Map<string, typeof relicEvals[number]>()
  for (const e of relicEvals) {
    relicScoreMap.set(e.relic.id, e)
    if (e.relic.name) relicScoreMap.set(e.relic.name.toLowerCase(), e)
  }

  // Detect fake_merchant: cursed/overpriced shop — items may have inflated prices
  // or be intentionally bad. Flag them to the user without over-penalizing legit items.
  const fakeMerchantPenalty = isFakeMerchant ? 1.5 : 0

  // Relic effects that change shop economics
  const playerRelics = player.relics ?? []
  const hasMembershipCard = playerRelics.some(r => r.name?.toLowerCase().includes('membership card'))
  const hasCourier = playerRelics.some(r => r.name?.toLowerCase().includes('courier'))
  const hasWhiteBeastStatue = playerRelics.some(r => r.name?.toLowerCase().includes('white beast statue'))
  // Effective price multiplier based on relics
  const priceMultiplier = hasMembershipCard ? 0.5 : hasCourier ? 0.8 : 1.0

  // Count empty potion slots for potion value
  const potionSlots = 3 // STS2 default
  const potionsHeld = player.potions?.length ?? 0
  const emptyPotionSlots = Math.max(0, potionSlots - potionsHeld)

  // Deck quality signals for removal value
  const codexDeck = deck.map(c =>
    c.id ? codex.cardById.get(c.id) : codex.cardByName?.get(c.name.toLowerCase())
  ).filter(Boolean)
  const curseCount = codexDeck.filter(c => c?.type === 'Curse').length
  const statusCount = codexDeck.filter(c => c?.type === 'Status').length
  const starterCount = codexDeck.filter(c => c?.rarity === 'Starter').length
  const deckSize = deck.length

  // Boss proximity flags
  const bossFloor = estimateBossFloor(act)
  const preBoss = isBossImminent(floor, bossFloor, 3)
  const upcomingThreat: 'elite' | 'boss' | 'none' = preBoss ? 'boss' : 'none'

  // Next-node context for map-aware scoring
  const hasEliteNext = nextOptions.some(n => n.type === 'Elite')

  // Removal target — the card most worth removing
  const removalTarget = findRemovalTarget(deck, codex, archetype)

  return items.map(item => {
    let score = 5
    let reasons: import('@/types/advisor').SynergyReason[] = []
    let itemIsCoreCard = false

    // Normalise category: the STS2 API uses `category` with value 'card_removal';
    // older/legacy responses may use `type` with value 'remove'. Unify to a single string.
    const itemCategory: 'card' | 'relic' | 'potion' | 'remove' | undefined =
      item.category === 'card_removal' ? 'remove'
      : item.category ?? item.type

    // Resolve the canonical id and name from whichever fields the API populated.
    const itemId   = item.card_id   ?? item.relic_id   ?? item.potion_id   ?? item.id   ?? ''
    const itemName = item.card_name ?? item.relic_name ?? item.potion_name ?? item.name ?? ''

    // Codex lookups: try the API id, then slug form of that id, then the display name.
    const idLower   = itemId.toLowerCase()
    const idSlug    = idLower.replace(/_/g, ' ')
    const nameLower = itemName.toLowerCase()

    const codexCardFallback = itemCategory === 'card'
      ? (codex.cardById.get(itemId)
          ?? codex.cardByName?.get(idSlug)
          ?? codex.cardByName?.get(nameLower))
      : undefined
    const codexRelicFallback = itemCategory === 'relic'
      ? (codex.relicById?.get(itemId)
          ?? codex.relicByName?.get(idSlug)
          ?? codex.relicByName?.get(nameLower))
      : undefined
    const codexPotionFallback = itemCategory === 'potion'
      ? (codex.potionById.get(itemId)
          ?? codex.potionByName?.get(idSlug)
          ?? codex.potionByName?.get(nameLower))
      : undefined

    // Build effective sub-objects from API fields + codex fallbacks.
    const effectiveCard: import('@/types/game-state').GameCard | undefined = item.card ?? (
      itemCategory === 'card'
        ? {
            id: itemId,
            name: itemName || codexCardFallback?.name || '',
            cost: item.card_cost ?? item.cost ?? codexCardFallback?.cost ?? 1,
            description: item.card_description ?? item.description ?? codexCardFallback?.description,
            rarity: item.card_rarity ?? item.rarity ?? codexCardFallback?.rarity,
            type: item.card_type ?? codexCardFallback?.type,
            keywords: item.keywords,
            is_upgraded: item.is_upgraded,
            target_type: item.target_type,
            can_play: item.can_play,
          }
        : undefined
    )
    const effectiveRelic: import('@/types/game-state').GameRelic | undefined = item.relic ?? (
      itemCategory === 'relic'
        ? {
            id: itemId,
            name: itemName || codexRelicFallback?.name || '',
            description: item.relic_description ?? item.description ?? codexRelicFallback?.description,
          }
        : undefined
    )
    const effectivePotion: import('@/types/game-state').GamePotion | undefined = item.potion ?? (
      itemCategory === 'potion'
        ? { id: itemId, name: itemName || codexPotionFallback?.name || '' }
        : undefined
    )

    // Display name: prefer the resolved name, fall back to a type label.
    const displayName = itemName
      || effectiveCard?.name
      || effectiveRelic?.name
      || effectivePotion?.name
      || (itemCategory === 'remove' ? 'Card Removal' : '')
      || (itemCategory === 'card' ? 'Card' : itemCategory === 'relic' ? 'Relic' : itemCategory === 'potion' ? 'Potion' : 'Item')

    if (itemCategory === 'card' && effectiveCard) {
      const cardEval = evaluateCard(
        effectiveCard,
        deck,
        player.relics ?? [],
        codex,
        archetype,
        player.status ?? [],
        act,
        floor,
        player.character,
        upcomingThreat,
        buildTargets,
      )
      score = cardEval.score
      reasons = cardEval.reasons
      itemIsCoreCard = cardEval.isCoreCard ?? false

      // Price penalty: cards over 150g represent poor economy unless very high value
      if (item.price > 150) score -= 0.5
      if (item.price > 200) score -= 0.5

      // Act-based cost penalty: expensive cards are harder to justify early
      if (act === 1 && item.price > 100) score -= 0.3

    } else if (itemCategory === 'relic' && effectiveRelic) {
      const relicEval = relicScoreMap.get(effectiveRelic.id)
        ?? relicScoreMap.get(effectiveRelic.name?.toLowerCase() ?? '')
      score = relicEval?.score ?? 5
      reasons = relicEval?.reasons ?? []

      // Price penalty for relics is smaller — relics have permanent value
      if (item.price > 250) score -= 0.5

      // Pre-boss: defensive relics become more valuable
      if (preBoss) {
        const rd = effectiveRelic.description?.toLowerCase() ?? ''
        if (rd.includes('block') || rd.includes('hp') || rd.includes('heal') || rd.includes('artifact')) {
          score += 0.3
        }
      }

    } else if (itemCategory === 'potion' && effectivePotion) {
      const cp = codexPotionFallback
        ?? codex.potionByName?.get(effectivePotion.name?.toLowerCase() ?? '')
      const potionName = cp?.name ?? effectivePotion.name ?? ''
      const rarityBase = cp?.rarity === 'Rare' ? 7.5 : cp?.rarity === 'Uncommon' ? 6.5 : 5.5
      const baseScore = POTION_SCORES[potionName] ?? rarityBase

      if (hasWhiteBeastStatue) {
        score = baseScore + 1.5
        reasons = [{ type: 'power-scaling', label: 'Free Potion', description: 'White Beast Statue: potions cost 0 gold here', weight: 2 }]
      } else if (emptyPotionSlots === 0) {
        score = baseScore - 1.5
        reasons = [{ type: 'deck-quality', label: 'Potion slots full', description: 'Would need to discard a held potion', weight: -1.5 }]
      } else {
        score = baseScore
        if (preBoss) {
          score += 0.5
          reasons = [{ type: 'power-scaling', label: 'Pre-boss', description: 'Stock up — potions are critical for the boss fight', weight: 0.5 }]
        } else {
          const floorInAct = ((floor - 1) % 17) + 1
          if (floorInAct >= 14) {
            score += 0.5
            reasons = [{ type: 'power-scaling', label: 'Pre-boss', description: 'Save for the boss fight', weight: 0.5 }]
          }
        }
        if (hasEliteNext && !preBoss) {
          score += 0.5
          reasons = [{ type: 'power-scaling', label: 'Elite ahead', description: 'Potions are valuable for the upcoming elite fight', weight: 0.5 }]
        }
      }

    } else if (itemCategory === 'remove') {
      if (curseCount > 0) {
        const curseMult = Math.min(1.5, 1 + curseCount * 0.15)
        score = Math.min(10, 9.5 * curseMult)
        reasons = [{ type: 'deck-quality', label: 'Remove a Curse!', description: `${curseCount} curse${curseCount > 1 ? 's' : ''} in deck — removal is critical`, weight: 4 }]
      } else if (statusCount > 0) {
        score = 8
        reasons = [{ type: 'deck-quality', label: 'Remove a Status', description: 'Status cards slow your draw engine', weight: 2.5 }]
      } else if (starterCount > 0 && deckSize > 15) {
        score = 7.5
        reasons = [{ type: 'deck-quality', label: 'Thin your deck', description: `${starterCount} starter card${starterCount > 1 ? 's' : ''} — removal improves consistency`, weight: 2 }]
      } else if (deckSize > 25) {
        score = 6.5
        reasons = [{ type: 'deck-quality', label: 'Large deck', description: 'Deck is large — removal improves draw consistency', weight: 1 }]
      } else {
        score = 5.5
        reasons = [{ type: 'deck-quality', label: 'Card Removal', description: 'Slim your deck for better consistency', weight: 0.5 }]
      }
      if (deckSize < 10 && curseCount === 0) score = Math.max(score - 1.5, 4)
    }

    // Fake merchant penalty
    score -= fakeMerchantPenalty

    // Apply relic price discounts to affordability check
    const effectivePrice = hasWhiteBeastStatue && itemCategory === 'potion'
      ? 0
      : Math.floor(item.price * priceMultiplier)
    const worthBuying = score >= 6.5 && player.gold >= effectivePrice

    // Add membership/courier discount note
    if ((hasMembershipCard || hasCourier) && itemCategory !== 'remove' && reasons.length > 0) {
      const discountLabel = hasMembershipCard ? 'Membership Card (-50%)' : 'Courier (-20%)'
      const discountDesc = hasMembershipCard ? 'Prices are 50% off — upgrade threshold' : 'Prices are 20% off'
      reasons = [{ type: 'power-scaling', label: discountLabel, description: discountDesc, weight: 0.5 }, ...reasons]
    }

    // goldFloor: minimum gold to hold for next shop visit
    // Set when there's a worthy item in this shop the player can't currently afford
    // (hints to hold gold rather than spending on marginal items now)
    const clampedScore = Math.max(1, Math.min(10, score))
    const canAffordNow = player.gold >= effectivePrice
    const goldFloor = clampedScore >= 6.5 && !canAffordNow && effectivePrice > 0
      ? effectivePrice
      : undefined

    return {
      itemId: itemId || undefined,
      name: displayName,
      type: itemCategory ?? 'card',
      price: item.price,
      score: clampedScore,
      rating: scoreToRating(score),
      reasons,
      worthBuying,
      removalTarget: itemCategory === 'remove' ? (removalTarget ?? undefined) : undefined,
      preBossUrgency: preBoss ? true : undefined,
      isCoreCard: itemIsCoreCard ? true : undefined,
      goldFloor,
    }
  }).sort((a, b) => b.score - a.score)
}
