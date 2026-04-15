import type { MapNode, PlayerState, GameRelic } from '@/types/game-state'
import type { PathScore, DeckAnalysis, DeckArchetype } from '@/types/advisor'
import { isBossImminent, estimateBossFloor } from './boss-advisor'
import { getEliteDifficulty } from './elite-advisor'

// ─── Room base utility ───────────────────────────────────────────────────────

/** Base desirability of a room type given current run context. */
function roomUtility(
  roomType: string,
  hpPercent: number,
  act: number,
  nearBoss: boolean,
  gold = 0,
  deckSize = 10,
): number {
  const t = roomType ?? ''
  if (t === 'Boss') return 0 // unavoidable, don't score

  if (t === 'Elite') {
    if (hpPercent < 0.45) return 0.4               // too risky at low HP
    if (nearBoss) return hpPercent > 0.7 ? 3 : 1   // near boss: only fight if healthy
    const actBonus = act >= 3 ? 0.8 : act === 2 ? 0.4 : 0
    return hpPercent > 0.65 ? 3.5 + actBonus : 1.5 + actBonus
  }

  if (t === 'RestSite') {
    if (nearBoss) return hpPercent < 0.75 ? 5 : 3
    if (hpPercent < 0.35) return 5.5
    if (hpPercent < 0.6)  return 4.5
    if (act >= 3)         return 3
    return 2
  }

  if (t === 'Shop') {
    const actBonus = act >= 2 ? 0.8 : 0
    // Base shop value scaled by gold: rich players get more out of shops
    const goldBonus = gold >= 200 ? 0.8 : gold >= 100 ? 0.4 : gold < 50 ? -0.4 : 0
    return 2 + actBonus + goldBonus
  }

  if (t === 'Unknown') {
    return act === 2 ? 2.5 : 2
  }

  if (t === 'Treasure') {
    return act >= 2 ? 3.5 : 3
  }

  if (t === 'Ancient') {
    return act >= 2 ? 4.5 : 4
  }

  if (t === 'Monster') {
    // Small decks benefit more from card rewards; large decks less so
    const deckSizeBonus = deckSize <= 10 ? 0.3 : deckSize >= 20 ? -0.2 : 0
    return (act === 1 ? 1.8 : 1.3) + deckSizeBonus
  }

  return 1.5
}

// ─── Risk label ──────────────────────────────────────────────────────────────

function riskLabel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 5) return 'low'
  if (score >= 2.5) return 'medium'
  return 'high'
}

// ─── Node labels ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  Monster:  'Monster fight',
  Elite:    'Elite fight',
  RestSite: 'Rest site',
  Shop:     'Shop',
  Unknown:  'Unknown event',
  Treasure: 'Treasure chest',
  Ancient:  'Ancient bonus',
  Boss:     'Boss',
}

function nodeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

function describeOption(node: MapNode): string {
  const immediate = nodeLabel(node.type)
  const ahead = (node.leads_to ?? []).slice(0, 2).map(n => nodeLabel(n.type))
  const suffix = ahead.length ? ` → ${ahead.join(', ')}` : ''
  return `${immediate}${suffix}`
}

// ─── Deck fit note ───────────────────────────────────────────────────────────

function buildDeckFitNote(nodeType: string, archetype: DeckArchetype, act: number): string | undefined {
  if (nodeType === 'Shop') {
    if (archetype.primary === 'poison') return 'Your Poison build benefits from shop removals'
    if (archetype.primary === 'exhaust') return 'Shop may have Exhaust synergy cards'
    if (act >= 2) return 'Mid-run shop: removal and upgrades available'
  }
  if (nodeType === 'Elite') {
    const archetypeLabels: Partial<Record<string, string>> = {
      'strength-scaling': 'Strength deck handles elites well',
      'orb-focus': 'Orb deck can burst elites quickly',
      'poison': 'Poison is strong against elites',
    }
    return archetypeLabels[archetype.primary]
  }
  if (nodeType === 'Unknown') {
    if (archetype.primary === 'exhaust') return 'Events may offer Exhaust-friendly rewards'
    if (archetype.primary === 'star-engine') return 'Events can grant Stars or run-changing choices'
  }
  return undefined
}

// ─── Relic awareness ─────────────────────────────────────────────────────────

function hasRelic(relics: GameRelic[], ...nameFragments: string[]): boolean {
  return relics.some(r => nameFragments.some(frag => r.name?.toLowerCase().includes(frag.toLowerCase())))
}

function relicPathNotes(relics: GameRelic[], nodeType: string): { scoreBonus: number; reason?: string } {
  let scoreBonus = 0
  let reason: string | undefined

  if (nodeType === 'Unknown') {
    if (hasRelic(relics, 'Tiny Chest')) {
      scoreBonus += 0.8
      reason = 'Tiny Chest: every 4th ? room is a Treasure chest'
    }
    if (hasRelic(relics, 'Juzu Bracelet')) {
      scoreBonus -= 1.5
      reason = 'Juzu Bracelet: ? rooms are always Monsters, not Events'
    }
  }

  if (nodeType === 'Monster') {
    if (hasRelic(relics, 'Prayer Wheel')) {
      scoreBonus += 0.6
      reason = 'Prayer Wheel: Monster rooms give an extra card reward'
    }
    if (hasRelic(relics, 'Maw Bank')) {
      scoreBonus += 0.5
      reason = 'Maw Bank: earn extra gold from monster fights'
    }
    if (hasRelic(relics, 'Golden Idol', 'Mark of the Bloom')) {
      scoreBonus += 0.4
      reason = 'Golden Idol: earn extra gold from fights'
    }
  }

  if (nodeType === 'Treasure') {
    if (hasRelic(relics, 'Matryoshka')) {
      scoreBonus += 1.2
      reason = 'Matryoshka: next 2 chest relics give 2 relics each'
    }
    if (hasRelic(relics, 'Crystal Key', 'Cursed Key')) {
      scoreBonus += 0.4
      reason = 'Cursed Key: chests give extra gold'
    }
  }

  if (nodeType === 'RestSite') {
    if (hasRelic(relics, 'Shovel')) {
      scoreBonus += 0.7
      reason = 'Shovel: can Dig at rest sites for a random relic'
    }
    if (hasRelic(relics, 'Dream Catcher')) {
      scoreBonus += 0.5
      reason = 'Dream Catcher: resting also adds a card to your deck'
    }
    if (hasRelic(relics, 'Fusion Hammer')) {
      scoreBonus += 0.3
      reason = 'Fusion Hammer: can only upgrade at rest sites (no smithing elsewhere)'
    }
    if (hasRelic(relics, 'Coffee Dripper')) {
      scoreBonus -= 1.2
      reason = 'Coffee Dripper: you cannot rest — rest sites only offer Smithing'
    }
    if (hasRelic(relics, 'Lantern', 'Burning Blood', 'Red Mask')) {
      // Burning Blood heals 6 after each combat; lantern + red mask less common
      // Just note smithing is the better use at full-ish HP
    }
  }

  if (nodeType === 'Shop') {
    if (hasRelic(relics, 'Membership Card')) {
      scoreBonus += 0.8
      reason = 'Membership Card: shop prices are 50% off'
    }
    if (hasRelic(relics, 'Courier')) {
      scoreBonus += 0.4
      reason = 'Courier: cards and potions are 20% cheaper'
    }
    if (hasRelic(relics, 'White Beast Statue')) {
      scoreBonus += 0.5
      reason = 'White Beast Statue: potions are free in shops'
    }
  }

  if (nodeType === 'Elite') {
    if (hasRelic(relics, 'Black Star')) {
      scoreBonus += 0.8
      reason = 'Black Star: elites drop an extra relic'
    }
    if (hasRelic(relics, 'Gremlin Horn')) {
      scoreBonus += 0.6
      reason = 'Gremlin Horn: gain 1 energy after elite fights'
    }
    if (hasRelic(relics, 'Bag of Preparation', 'Ring of the Snake')) {
      // Draw relics slightly favour elites (more cards to deal with threats)
      scoreBonus += 0.2
    }
  }

  return { scoreBonus, reason }
}

// ─── Deeper lookahead ────────────────────────────────────────────────────────

/**
 * Collect all node types reachable within `depth` steps from a node's leads_to.
 * Returns a flat deduplicated list for display.
 */
function collectFutureNodes(node: MapNode, depth = 2): string[] {
  const types = new Set<string>()
  let frontier: Array<{ col: number; row: number; type: string }> = node.leads_to ?? []
  for (let d = 0; d < depth; d++) {
    const next: Array<{ col: number; row: number; type: string }> = []
    for (const n of frontier) {
      if (n.type && n.type !== 'Boss') types.add(n.type)
      // leads_to on nested nodes may not be populated — that's fine
    }
    frontier = next
  }
  return [...types]
}

/**
 * Score the full path including 2 levels of lookahead (weighted decay).
 * level-1 nodes contribute 50%, level-2 nodes contribute 20%.
 */
function scorePath(
  node: MapNode,
  hpPercent: number,
  act: number,
  gold: number,
  deckSize: number,
): number {
  const base = roomUtility(node.type, hpPercent, act, false, gold, deckSize)

  const l1 = node.leads_to ?? []
  const l1Score = l1.length > 0
    ? l1.reduce((s, n) => s + roomUtility(n.type, hpPercent, act, false, gold, deckSize), 0) / l1.length
    : 0

  // depth-2: each l1 node's leads_to
  const l2Nodes = l1.flatMap(n => (n as MapNode).leads_to ?? [])
  const l2Score = l2Nodes.length > 0
    ? l2Nodes.reduce((s, n) => s + roomUtility(n.type, hpPercent, act, false, gold, deckSize), 0) / l2Nodes.length
    : 0

  return base + l1Score * 0.5 + l2Score * 0.2
}

// ─── Shop affordability ──────────────────────────────────────────────────────

function shopAffordability(gold: number, act: number): 'rich' | 'okay' | 'tight' {
  // Rough thresholds: removal costs ~75-100g, cards ~50-80g, relics ~150g
  const comfortable = act >= 2 ? 175 : 125
  const tight = act >= 2 ? 80 : 50
  if (gold >= comfortable) return 'rich'
  if (gold >= tight) return 'okay'
  return 'tight'
}

// ─── Rest HP estimate ─────────────────────────────────────────────────────────

function estimateHpAfterRest(player: PlayerState, relics: GameRelic[]): number {
  // Resting heals 30% of max HP (rounded down)
  let healAmt = Math.floor(player.max_hp * 0.30)
  // Regen relic / Lantern / other heals not modelled here — just base rest
  const newHp = Math.min(player.hp + healAmt, player.max_hp)
  return newHp / player.max_hp
}

// ─── Path summary sentence ───────────────────────────────────────────────────

function buildSummary(
  node: MapNode,
  hpPercent: number,
  gold: number,
  act: number,
  nearBoss: boolean,
  bossImminent: boolean,
  relics: GameRelic[],
  deckSize: number,
): string {
  const t = node.type

  if (t === 'RestSite') {
    const canRest = !hasRelic(relics, 'Coffee Dripper')
    if (bossImminent && hpPercent < 0.75) return 'Rest before the boss to recover HP'
    if (!canRest) return 'Upgrade a card here — Coffee Dripper prevents resting'
    if (hpPercent < 0.35) return 'Critical HP — rest to survive the next fight'
    if (hpPercent < 0.6) return 'Rest to top up HP before pressing on'
    if (hpPercent >= 0.85) return 'HP is healthy — consider smithing a key card instead'
    return 'Rest or smith depending on your HP needs'
  }

  if (t === 'Shop') {
    const afford = shopAffordability(gold, act)
    if (bossImminent) return 'Last shop before boss — buy potions and key upgrades'
    if (afford === 'rich') return 'You have plenty of gold — shop for removals and relics'
    if (afford === 'tight') return 'Low on gold — visit the shop only if you need something specific'
    if (act >= 2) return 'Mid-run shop: card removal is the best purchase in most cases'
    return 'Visit the shop for card removal and deck fixes'
  }

  if (t === 'Elite') {
    if (hpPercent < 0.45) return 'Too low on HP for an elite — skip if possible'
    if (bossImminent && hpPercent < 0.65) return 'Boss is close — consider skipping this elite to save HP'
    const eliteRelic = hasRelic(relics, 'Black Star') ? ' (+2 relics with Black Star)' : ''
    if (hpPercent > 0.7) return `Good HP for an elite — worth the relic reward${eliteRelic}`
    return 'Manageable elite — fight for the relic if your deck can handle it'
  }

  if (t === 'Unknown') {
    if (hasRelic(relics, 'Tiny Chest')) return 'Tiny Chest: your next ? room might be a Treasure'
    if (hasRelic(relics, 'Juzu Bracelet')) return 'Juzu Bracelet: ? rooms are Monsters, not Events'
    return 'Events are generally safe and often offer free resources'
  }

  if (t === 'Monster') {
    if (deckSize <= 8) return 'Small deck — fight to earn card rewards and build power'
    if (act === 1) return 'Act 1 fights build your deck — worth taking for card rewards'
    return 'Monster fight — fight for gold and card rewards'
  }

  if (t === 'Treasure') {
    const matryoshka = hasRelic(relics, 'Matryoshka') ? ' (Matryoshka: double relic!)' : ''
    return `Free relic with no combat risk${matryoshka}`
  }

  if (t === 'Ancient') {
    return 'Ancient blessing — pick the option that fits your build'
  }

  return nodeLabel(t)
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function evaluatePaths(
  nextOptions: MapNode[],
  player: PlayerState,
  act: number,
  floor = 1,
  deckAnalysis?: DeckAnalysis | null,
  relics: GameRelic[] = [],
): PathScore[] {
  if (!nextOptions?.length) return []

  const hpPercent = player.hp / player.max_hp
  const gold = player.gold ?? 0
  const deckSize = deckAnalysis?.totalCards ?? 10
  const bossFloor = estimateBossFloor(act)
  const floorInAct = ((floor - 1) % 17) + 1
  const nearBoss = floorInAct >= 14
  const bossImminent = isBossImminent(floor, bossFloor, 3)
  const archetype = deckAnalysis?.archetype

  const scored = nextOptions.map(node => {
    let immediateScore = roomUtility(node.type, hpPercent, act, nearBoss, gold, deckSize)

    // Elite difficulty adjustment based on deck matchup
    let eliteDifficulty: 'easy' | 'neutral' | 'hard' | undefined
    if (node.type === 'Elite' && archetype) {
      eliteDifficulty = 'neutral'
      if (['strength-scaling', 'orb-focus', 'poison'].includes(archetype.primary)) {
        eliteDifficulty = 'easy'
        immediateScore += 0.5
      }
      if (['block-turtle'].includes(archetype.primary) && act >= 2) {
        eliteDifficulty = 'hard'
        immediateScore -= 0.3
      }
    }

    // Boss prep bonuses
    if (node.type === 'Shop' && bossImminent) immediateScore += 0.8
    if (node.type === 'RestSite' && bossImminent && hpPercent < 0.9) immediateScore += 0.5

    // Relic-aware scoring
    const relicEffect = relicPathNotes(relics, node.type)
    immediateScore += relicEffect.scoreBonus

    // Depth-2 lookahead
    const l1 = node.leads_to ?? []
    const l1Score = l1.length > 0
      ? l1.reduce((s, n) => s + roomUtility(n.type, hpPercent, act, false, gold, deckSize), 0) / l1.length
      : 0
    const l2Nodes = l1.flatMap(n => (n as MapNode).leads_to ?? [])
    const l2Score = l2Nodes.length > 0
      ? l2Nodes.reduce((s, n) => s + roomUtility(n.type, hpPercent, act, false, gold, deckSize), 0) / l2Nodes.length
      : 0

    const score = immediateScore + l1Score * 0.5 + l2Score * 0.2
    const label = describeOption(node)
    const reasons: string[] = []

    // Relic-based reason (most specific insight)
    if (relicEffect.reason) reasons.push(relicEffect.reason)

    // HP-based reasons
    if (hpPercent < 0.4 && node.type === 'Elite') reasons.push('Low HP — risky elite, avoid if possible')
    if (hpPercent < 0.35 && node.type === 'RestSite') reasons.push('Critical HP — rest to recover before next fight')
    else if (hpPercent < 0.45 && node.type === 'RestSite') reasons.push('Rest to recover HP before next fight')
    if (hpPercent > 0.7 && node.type === 'Elite') reasons.push('Healthy — worth the elite relic reward')
    if (hpPercent >= 0.85 && node.type === 'RestSite') reasons.push('High HP — consider smithing a card instead of resting')

    // Boss prep reasons
    if (bossImminent && node.type === 'RestSite') reasons.push('Pre-boss rest — top up HP for the boss fight')
    if (bossImminent && node.type === 'Shop') reasons.push('Last shop before boss — stock up on potions and key cards')

    // Gold-aware shop reasons
    if (node.type === 'Shop') {
      const afford = shopAffordability(gold, act)
      if (afford === 'rich') reasons.push(`${gold}g available — you can afford removals and relics`)
      else if (afford === 'tight') reasons.push(`Only ${gold}g — limited buying power this visit`)
    }

    // Deck-size-aware monster reasons
    if (node.type === 'Monster' && deckSize <= 8) reasons.push('Small deck — fight for card rewards to grow power')
    if (node.type === 'Monster' && deckSize >= 22) reasons.push('Large deck — card rewards are less impactful now')

    // Act-specific reasons
    if (act === 1 && node.type === 'Monster') reasons.push('Act 1 — fight for card rewards to build your deck')
    if (act >= 2 && node.type === 'Shop') reasons.push('Mid-run shop: card removal is usually the best buy')
    if (act >= 2 && node.type === 'Elite') reasons.push(`Act ${act} elite: better relic pool`)
    if (act >= 3 && node.type === 'RestSite' && !bossImminent) reasons.push('Act 3 — rest sites are scarce, use them wisely')

    // Node type reasons
    if (node.type === 'Treasure') reasons.push('Free relic — no combat risk')
    if (node.type === 'Unknown') reasons.push('Events often grant free resources or impactful choices')
    if (node.type === 'Ancient') reasons.push('Ancient blessing — usually a strong gain')

    // Deck fit note
    const deckFitNote = archetype ? buildDeckFitNote(node.type, archetype, act) : undefined

    // Shop affordability tag
    const shopAffTag = node.type === 'Shop' ? shopAffordability(gold, act) : undefined

    // HP after rest estimate
    const hpAfterRest = node.type === 'RestSite' ? estimateHpAfterRest(player, relics) : undefined

    // Depth-2 future node types for display
    const futureTypes = new Set<string>()
    for (const l1n of l1) {
      for (const l2n of (l1n as MapNode).leads_to ?? []) {
        if (l2n.type && l2n.type !== 'Boss') futureTypes.add(l2n.type)
      }
    }

    const pathScore: PathScore = {
      node: { x: node.col, y: node.row, type: node.type },
      score,
      label,
      reasons: reasons.slice(0, 3),
      risk: riskLabel(score),
      deckFitNote,
      bossPrep: bossImminent && (node.type === 'RestSite' || node.type === 'Shop'),
      eliteDifficulty,
      hpAfterRest,
      shopAffordability: shopAffTag,
      futureNodes: futureTypes.size > 0 ? [...futureTypes] : undefined,
      summary: buildSummary(node, hpPercent, gold, act, nearBoss, bossImminent, relics, deckSize),
    }
    return pathScore
  }).sort((a, b) => b.score - a.score)

  // Mark the best option when there's a meaningful gap from second place
  if (scored.length >= 2) {
    const gap = scored[0].score - scored[1].score
    if (gap >= 0.8) {
      scored[0] = { ...scored[0], isBest: true }
    }
  } else if (scored.length === 1) {
    scored[0] = { ...scored[0], isBest: true }
  }

  return scored
}
