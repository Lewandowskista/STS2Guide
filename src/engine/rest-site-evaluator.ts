import type { GameState, MapNode } from '@/types/game-state'
import type { CodexData } from '@/types/codex'
import { lookupCard } from '@/types/codex'
import type { RestSiteAdvice, RestAction, DeckAnalysis } from '@/types/advisor'

interface NextNodeContext {
  hasEliteNext: boolean
  hasEliteInTwo: boolean      // Elite in leads_to of Elite-only immediate nodes
  hasShopNext: boolean
  hasRestSiteNext: boolean
  hasTreasureNext: boolean
  eliteChainRisk: 'none' | 'single' | 'double'
}

function analyzeNextNodes(nextOptions: MapNode[]): NextNodeContext {
  if (!nextOptions.length) {
    return { hasEliteNext: false, hasEliteInTwo: false, hasShopNext: false,
             hasRestSiteNext: false, hasTreasureNext: false, eliteChainRisk: 'none' }
  }
  const immediateTypes = nextOptions.map(n => n.type)
  // Only inspect leads_to of Elite nodes to avoid false chain-risk from safe parallel paths
  const eliteLeadsTo = nextOptions
    .filter(n => n.type === 'Elite')
    .flatMap(n => (n.leads_to ?? []).map(l => l.type))

  const hasEliteNext = immediateTypes.includes('Elite')
  const hasEliteInTwo = eliteLeadsTo.includes('Elite')

  let eliteChainRisk: 'none' | 'single' | 'double' = 'none'
  if (hasEliteNext && hasEliteInTwo) eliteChainRisk = 'double'
  else if (hasEliteNext) eliteChainRisk = 'single'

  return {
    hasEliteNext,
    hasEliteInTwo,
    hasShopNext: immediateTypes.includes('Shop'),
    hasRestSiteNext: immediateTypes.includes('RestSite'),
    hasTreasureNext: immediateTypes.includes('Treasure'),
    eliteChainRisk,
  }
}

export function evaluateRestSite(
  state: GameState,
  codex: CodexData,
  deckAnalysis: DeckAnalysis | null,
  nextOptions: MapNode[] = [],
): RestSiteAdvice | null {
  if (!state.player) return null

  const player = state.player
  // The API sometimes sends state_type:'rest_site' without a rest_site payload.
  // Fall back to a permissive default so the panel still renders.
  const site = state.rest_site ?? {}
  const hpPct = player.hp / player.max_hp
  const act = state.run?.act ?? 1
  const floor = state.run?.floor ?? 1
  // Normalised character key for per-character logic
  const characterId = (player.character ?? '').toLowerCase()

  // Determine proximity to boss (act bosses are typically at floor 17, 34, 51 in vanilla)
  const floorInAct = floor % 17
  const nearBoss = floorInAct >= 14 || floorInAct === 0  // within 3 floors of boss

  const nextCtx = analyzeNextNodes(nextOptions)

  // Analyse deck for upgrade candidates
  const allDeckCards = [
    ...(player.draw_pile ?? []),
    ...(player.discard_pile ?? []),
    ...(player.exhaust_pile ?? []),
    ...(player.hand ?? []),
  ]
  const unupgradedCards = allDeckCards.filter(c => !c.is_upgraded)
  const upgradePriorities = rankUpgradeCandidates(unupgradedCards, codex, deckAnalysis)

  type ActionEntry = {
    action: RestAction
    available: boolean
    label: string
    advice: string
    priority: number
  }

  const actions: ActionEntry[] = []

  // ── REST ─────────────────────────────────────────────────────────────────
  const restAmount = site.rest_amount ?? Math.floor(player.max_hp * 0.3)
  const healedHp = Math.min(player.max_hp, player.hp + restAmount)
  const hpAfterRest = (healedHp / player.max_hp)
  let restAdvice: string
  let restPriority: number

  if (hpPct < 0.35) {
    restAdvice = `Critical HP — heals ${restAmount} HP (${player.hp} → ${healedHp})`
    restPriority = 1
  } else if (hpPct < 0.55) {
    restAdvice = `Low HP — heals to ${Math.round(hpAfterRest * 100)}% (${player.hp} → ${healedHp})`
    restPriority = nearBoss ? 1 : 2
  } else if (nearBoss) {
    restAdvice = `Near boss — heal up before the fight (${player.hp} → ${healedHp})`
    restPriority = hpPct < 0.75 ? 1 : 2
  } else {
    restAdvice = `HP is fine (${Math.round(hpPct * 100)}%) — consider upgrading instead`
    restPriority = 3
  }

  // ── Rest lookahead modifiers ──────────────────────────────────────────────
  if (nextOptions.length > 0) {
    if (nextCtx.eliteChainRisk === 'double' && hpPct < 0.85 && restPriority > 1) {
      restPriority = 1
      restAdvice += ' — Two elites ahead, healing is critical'
    } else if (nextCtx.hasEliteNext && hpPct < 0.75 && restPriority > 1) {
      restPriority = 1
      restAdvice += ` — Elite ahead, prioritize healing (${Math.round(hpPct * 100)}% HP)`
    }
    if (nextCtx.hasRestSiteNext && hpPct >= 0.55 && restPriority === 2) {
      restPriority = 3
      restAdvice += ' — Another rest site nearby, safe to upgrade now'
    }
    if (nextCtx.hasShopNext && hpPct >= 0.55 && hpPct < 0.70 && restPriority === 2) {
      restAdvice += ' — Shop ahead if you prefer potions'
    }
  }

  if (site.can_rest !== false) {
    actions.push({ action: 'rest', available: true, label: `Rest (+${restAmount} HP)`, advice: restAdvice, priority: restPriority })
  }

  // ── SMITH (upgrade) ───────────────────────────────────────────────────────
  let smithAdvice: string
  let smithPriority: number

  if (upgradePriorities.length === 0) {
    smithAdvice = 'No upgradeable cards in deck'
    smithPriority = 4
  } else {
    const best = upgradePriorities[0]
    smithAdvice = `Upgrade ${best.name} — ${best.reason}`
    // Smith is better when HP is reasonable and there's a high-impact upgrade
    if (hpPct >= 0.55 && !nearBoss) {
      smithPriority = best.impact === 'high' ? 1 : 2
    } else if (hpPct >= 0.40 && !nearBoss) {
      smithPriority = best.impact === 'high' ? 2 : 3
    } else {
      smithPriority = 3 // healing almost always beats smithing at low HP
    }
  }

  // ── Smith lookahead modifiers ─────────────────────────────────────────────
  if (nextOptions.length > 0 && upgradePriorities.length > 0) {
    if (nextCtx.hasTreasureNext && hpPct >= 0.5 && smithPriority > 1) {
      smithPriority = Math.max(1, smithPriority - 1)
      smithAdvice += ' — Treasure next, safe floor to upgrade first'
    }
    if (nextCtx.hasRestSiteNext && hpPct >= 0.55 && smithPriority > 1) {
      smithPriority = Math.max(1, smithPriority - 1)
      smithAdvice += ' — Can heal at the next rest site'
    }
    if (nextCtx.hasEliteNext && hpPct < 0.75 && smithPriority < 3) {
      smithPriority = Math.min(4, smithPriority + 1)
    }
  }

  if (site.can_smith !== false) {
    actions.push({
      action: 'smith',
      available: upgradePriorities.length > 0,
      label: 'Smith (upgrade a card)',
      advice: smithAdvice,
      priority: smithPriority,
    })
  }

  // ── LIFT (gain Strength permanently) ─────────────────────────────────────
  if (site.can_lift !== false && site.can_lift) {
    const archIsStr = deckAnalysis?.archetype.primary === 'strength-scaling'
    // Defect doesn't benefit from Strength at all — deprioritise significantly
    const isDefect = characterId === 'defect'
    // Necrobinder: check if there are Ethereal-scaling cards before recommending
    const isNecrobinder = characterId === 'necrobinder'
    let liftAdvice: string
    let liftPriority: number
    if (isDefect) {
      liftAdvice = 'Strength does not affect Orb or Focus — very low value for Defect'
      liftPriority = 5
    } else if (archIsStr) {
      liftAdvice = 'Excellent — permanent Strength scales your entire attack deck'
      liftPriority = 1
    } else if (isNecrobinder) {
      liftAdvice = 'Permanent Strength — useful if your Necrobinder deck attacks often'
      liftPriority = 3
    } else {
      liftAdvice = 'Permanent Strength bonus — great for attack-heavy builds'
      liftPriority = 2
    }
    actions.push({
      action: 'lift',
      available: true,
      label: 'Lift (+1 Strength permanently)',
      advice: liftAdvice,
      priority: liftPriority,
    })
  }

  // ── TOKE (remove a card) ──────────────────────────────────────────────────
  if (site.can_toke !== false && site.can_toke) {
    const hasCurse = allDeckCards.some(c => {
      const cx = lookupCard(codex, c.id, c.name)
      return cx?.type === 'Curse' || cx?.type === 'Status'
    })
    const hasStarterStrike = allDeckCards.some(c => c.name.toLowerCase().includes('strike'))
    // Silent benefits especially from deck thinning — a lean deck cycles faster for combo turns
    const isSilent = characterId === 'silent'
    const isSilentBigDeck = isSilent && allDeckCards.length > 18
    let tokeAdvice: string
    let tokePriority: number
    if (hasCurse) {
      tokeAdvice = 'Remove a curse — excellent value'
      tokePriority = 1
    } else if (isSilentBigDeck) {
      tokeAdvice = `Deck has ${allDeckCards.length} cards — Silent benefits greatly from thinning for faster cycling`
      tokePriority = 1
    } else if (hasStarterStrike) {
      tokeAdvice = 'Remove a Strike to thin your deck'
      tokePriority = 2
    } else {
      tokeAdvice = 'Thin your deck for better consistency'
      tokePriority = 3
    }
    actions.push({
      action: 'toke',
      available: true,
      label: 'Toke (remove a card)',
      advice: tokeAdvice,
      priority: tokePriority,
    })
  }

  // ── DIG (obtain a random relic) ───────────────────────────────────────────
  if (site.can_dig !== false && site.can_dig) {
    actions.push({
      action: 'dig',
      available: true,
      label: 'Dig (random relic)',
      advice: 'Random relic — high variance, generally good if HP is fine',
      priority: hpPct >= 0.6 ? 2 : 3,
    })
  }

  // ── RECALL (retrieve a used potion) ──────────────────────────────────────
  if (site.can_recall) {
    const potionSlots = 3
    const potionsHeld = (player.potions?.length ?? 0)
    const emptySlots = Math.max(0, potionSlots - potionsHeld)
    const recallAdvice = emptySlots > 0
      ? 'Recall a used potion — free combat resource for the next fight'
      : 'Recall is available but potion slots are full'
    actions.push({
      action: 'recall',
      available: emptySlots > 0,
      label: 'Recall (retrieve a potion)',
      advice: recallAdvice,
      // Recall is strong if we have space, near boss, and HP is fine enough to skip healing
      priority: emptySlots > 0 && hpPct >= 0.6 ? (nearBoss ? 1 : 2) : 4,
    })
  }

  // ── Sort by priority ──────────────────────────────────────────────────────
  actions.sort((a, b) => a.priority - b.priority)

  const best = actions.find(a => a.available) ?? actions[0]
  const recommended = best?.action ?? 'rest'

  let topReason: string
  if (recommended === 'rest') {
    topReason = restAdvice
  } else if (recommended === 'smith' && upgradePriorities.length > 0) {
    topReason = smithAdvice
  } else {
    topReason = best?.advice ?? ''
  }

  return { recommended, reason: topReason, actions }
}

// ─── Upgrade candidate ranking ────────────────────────────────────────────────

interface UpgradeCandidate {
  name: string
  reason: string
  impact: 'high' | 'medium' | 'low'
}

// Cards that are the highest-priority upgrades for a specific archetype
const ARCHETYPE_UPGRADE_PRIORITIES: Partial<Record<string, string[]>> = {
  'poison': ['Catalyst', 'Noxious Fumes', 'Crippling Cloud', 'Bouncing Flask', 'Deadly Poison'],
  'exhaust': ['Corruption', 'Feel No Pain', 'Dark Embrace', 'Sentinel', 'Charon'],
  'strength-scaling': ['Inflame', 'Limit Break', 'Whirlwind', 'Bash', 'Pummel'],
  'orb-focus': ['Defragment', 'Electrodynamics', 'Blizzard', 'Glacier', 'Ball Lightning'],
  'block-turtle': ['Barricade', 'Impervious', 'Body Slam', 'Entrench', 'Fortress'],
  'shiv': ['Accuracy', 'Thousand Cuts', 'Blade Dance', 'Cloak And Dagger'],
  'discard': ['Tactician', 'Reflex', 'Wraith Form'],
  'star-engine': ['Eruption', 'Windmill Strike', 'Prostrate'],
  'draw-engine': ['Adrenaline', 'Expertise', 'Bullet Time', 'Streamline'],
}

// Cards that have especially impactful upgrades
const HIGH_IMPACT_UPGRADES = new Set([
  // Ironclad
  'Bash', 'Cleave', 'Whirlwind', 'Bludgeon', 'Fiend Fire', 'Pummel', 'Uppercut',
  'Barricade', 'Entrench', 'Impervious', 'Body Slam', 'Corruption',
  'Feel No Pain', 'Dark Embrace', 'Inflame', 'Limit Break',
  // Silent
  'Crippling Cloud', 'Noxious Fumes', 'Catalyst', 'Blade Dance', 'Thousand Cuts',
  'Accuracy', 'Hand of Greed', 'Siphon Soul', 'Wraith Form',
  // Defect
  'Ball Lightning', 'Glacier', 'Defragment', 'Electrodynamics',
  // Regent
  'Wreath of Flame', 'Eruption', 'Windmill Strike',
  'Prostrate', 'Sanctity', 'Spirit Shield', 'Mantra',
  // General
  'Adrenaline', 'Bullet Time', 'Expertise',
])

// Strikes/Defends have low-impact upgrades — generally not worth smithing unless nothing better
// Note: 'Eruption' intentionally excluded — it's a cornerstone card for Regent builds and
// belongs in HIGH_IMPACT_UPGRADES, not here.
const LOW_IMPACT_UPGRADES = new Set([
  'Strike', 'Defend', 'Neutralize', 'Survivor', 'Zap', 'Dualcast', 'Bite',
])

function rankUpgradeCandidates(
  unupgraded: Array<{ name: string; id?: string }>,
  codex: CodexData,
  deckAnalysis: DeckAnalysis | null,
): UpgradeCandidate[] {
  const archPrimary = deckAnalysis?.archetype.primary ?? 'balanced'

  const candidates: UpgradeCandidate[] = unupgraded.map(card => {
    const name = card.name

    let impact: 'high' | 'medium' | 'low' = 'medium'
    let reason = 'upgrade improves effectiveness'

    const archetypePriority = ARCHETYPE_UPGRADE_PRIORITIES[archPrimary] ?? []
    const isArchetypePriority = archetypePriority.includes(name)

    if (HIGH_IMPACT_UPGRADES.has(name) || isArchetypePriority) {
      impact = 'high'
      reason = getUpgradeReason(name, archPrimary)
      if (isArchetypePriority && !HIGH_IMPACT_UPGRADES.has(name)) {
        reason = `Best upgrade for your ${archPrimary} build`
      } else if (isArchetypePriority) {
        reason = `[${archPrimary}] ${reason}`
      }
    } else if (LOW_IMPACT_UPGRADES.has(name)) {
      impact = 'low'
      reason = '+1 damage/block — minor improvement'
    } else {
      // Fall back to codex upgrade_description for unknown cards
      const codexCard = card.id
        ? codex.cardById.get(card.id)
        : codex.cardByName?.get(name.toLowerCase())
      if (codexCard?.upgrade_description) {
        const upgradeText = codexCard.upgrade_description.toLowerCase()
        // Heuristic: cost reduction or large numeric delta → high impact
        if (upgradeText.includes('cost') || upgradeText.match(/\+\d{2,}/) || upgradeText.includes('retain')) {
          impact = 'high'
        }
        // Use the raw upgrade description as the reason (truncate if very long)
        reason = codexCard.upgrade_description.length > 80
          ? codexCard.upgrade_description.slice(0, 77) + '…'
          : codexCard.upgrade_description
      }
    }

    return { name, reason, impact }
  })

  // Sort: high impact first, then medium, skip low unless nothing else
  return candidates.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.impact] - order[b.impact]
  })
}

function getUpgradeReason(cardName: string, archPrimary: string): string {
  const reasons: Record<string, string> = {
    'Bash': 'applies 4 Vulnerable instead of 2 — doubles follow-up damage window',
    'Whirlwind': 'deals more damage per hit at X cost',
    'Pummel': 'deals 4 hits of 2 damage instead of 3 — notable multi-hit increase',
    'Uppercut': 'applies 2 Weak + 2 Vulnerable instead of 1 each',
    'Barricade': 'cost drops to 2 — core turtle card',
    'Entrench': 'cost drops to 1 — much easier to play',
    'Impervious': 'grants 40 block instead of 30',
    'Corruption': 'cost drops to 2 — game-changing for exhaust builds',
    'Feel No Pain': 'grants 6 block per exhaust instead of 4',
    'Inflame': 'grants 3 Strength instead of 2',
    'Limit Break': 'retains Strength gain (Retain keyword)',
    'Catalyst': 'triples poison instead of doubles — massive damage spike',
    'Noxious Fumes': 'applies 3 Poison/turn instead of 2',
    'Crippling Cloud': 'applies 4 Weak + 4 Vulnerable instead of 2 each',
    'Siphon Soul': 'increases stat drain amount — stronger debuffing',
    'Wraith Form': 'cost drops to 3 — more energy for other cards',
    'Defragment': 'grants 2 Focus instead of 1',
    'Electrodynamics': 'Lightning orbs hit all enemies',
    'Blade Dance': 'creates 3 Shivs instead of 2',
    'Thousand Cuts': 'deals 2 damage per card instead of 1',
    'Accuracy': 'grants 6 Shiv bonus instead of 4',
    'Eruption': 'cost drops to 1 — transforms into a 1-cost heavy attack',
    'Windmill Strike': 'gains 1 more damage per Star spent',
    'Adrenaline': 'draws 2 and gains 2 energy instead of 1',
    'Bullet Time': 'cost drops to 0 — free tempo',
  }
  return reasons[cardName] ?? `high-impact upgrade for ${archPrimary} builds`
}
