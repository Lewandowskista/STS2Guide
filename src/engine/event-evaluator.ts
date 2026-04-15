import type { GameState } from '@/types/game-state'
import type { CodexData } from '@/types/codex'
import type { EventAnalysis, EventOptionAnalysis, DeckAnalysis, DeckArchetype } from '@/types/advisor'
import { evaluateRelics } from './relic-evaluator'

// ─── Text parsers ──────────────────────────────────────────────────────────────

function parseGoldCost(text: string): number {
  const m = text.match(/[Pp]ay\s+(\d+)\s+[Gg]old/) ?? text.match(/[Cc]osts?\s+(\d+)\s+[Gg]old/)
  return m ? parseInt(m[1]) : 0
}

function parseGoldGain(text: string): number {
  const m = text.match(/[Gg]ain\s+(\d+)\s+[Gg]old/) ?? text.match(/[Gg]et\s+(\d+)\s+[Gg]old/)
  return m ? parseInt(m[1]) : 0
}

/** Parse HP loss from text. Handles: "lose X HP", "lose X Max HP", "reduce max HP by X",
 *  "lose X max", "sacrifice X HP". Does NOT fire on "gain X max HP". */
function parseHpLoss(text: string): number {
  // "reduce max hp by X" or "reduced by X"
  const reduceMatch = text.match(/[Rr]educe[sd]?\s+(?:max\s+)?[Hh][Pp]\s+by\s+(\d+)/)
  if (reduceMatch) return parseInt(reduceMatch[1])
  // "lose X max HP" / "lose X HP"
  const loseMatch = text.match(/[Ll]ose\s+(\d+)\s+[Mm]ax/) ?? text.match(/[Ll]ose\s+(\d+)\s+[Hh][Pp]/)
  if (loseMatch) return parseInt(loseMatch[1])
  // "sacrifice X HP"
  const sacrificeMatch = text.match(/[Ss]acrifice\s+(\d+)\s+[Hh][Pp]/)
  if (sacrificeMatch) return parseInt(sacrificeMatch[1])
  return 0
}

/** Parse Max HP loss specifically (permanent). */
function parseMaxHpLoss(text: string): number {
  const reduceMatch = text.match(/[Rr]educe[sd]?\s+(?:max\s+)?[Hh][Pp]\s+by\s+(\d+)/)
  if (reduceMatch) return parseInt(reduceMatch[1])
  const loseMaxMatch = text.match(/[Ll]ose\s+(\d+)\s+[Mm]ax/)
  if (loseMaxMatch) return parseInt(loseMaxMatch[1])
  return 0
}

/** Parse HP gain from text. Handles: "gain X HP", "restore X HP", "gain X max HP". */
function parseHpGain(text: string): number {
  const m = text.match(/[Gg]ain\s+(\d+)\s+[Hh][Pp]/) ?? text.match(/[Rr]estore\s+(\d+)\s+[Hh][Pp]/)
  return m ? parseInt(m[1]) : 0
}

/** Parse Max HP gain from text: "gain X max HP", "increase max HP by X". */
function parseMaxHpGain(text: string): number {
  const gainMax = text.match(/[Gg]ain\s+(\d+)\s+[Mm]ax\s+[Hh][Pp]/)
  if (gainMax) return parseInt(gainMax[1])
  const increaseMax = text.match(/[Ii]ncrease\s+(?:max\s+)?[Hh][Pp]\s+by\s+(\d+)/)
  if (increaseMax) return parseInt(increaseMax[1])
  return 0
}

// ─── Option scoring ────────────────────────────────────────────────────────────

/**
 * Convert a recommendation + deck context into a numeric score (0–100) for ranking.
 * Used to identify the single best pick when multiple options look positive.
 */
function scoreOption(
  recommendation: 'take' | 'avoid' | 'situational',
  descLower: string,
  relicName: string,
  hpLoss: number,
  maxHpLoss: number,
  maxHpGain: number,
  hpGain: number,
  goldCost: number,
  goldGain: number,
  playerHp: number,
  playerMaxHp: number,
  archPrimary: string,
  weaknesses: DeckAnalysis['weaknesses'],
  deckAnalysis: DeckAnalysis | null,
  codexRelicScore?: number,
): number {
  // Base score from recommendation tier
  let score = recommendation === 'take' ? 60 : recommendation === 'situational' ? 30 : 5

  // Permanent Max HP gain — excellent long-term value
  if (maxHpGain > 0) score += maxHpGain * 3

  // Permanent Max HP loss — heavy penalty (permanent, compounding)
  if (maxHpLoss > 0) score -= maxHpLoss * 4

  // Current HP loss — smaller penalty (temporary pain)
  const currentHpLoss = hpLoss - maxHpLoss
  if (currentHpLoss > 0) {
    const hpPercent = playerHp / playerMaxHp
    score -= currentHpLoss * (hpPercent < 0.5 ? 3 : 1.5)
  }

  // HP heal
  if (hpGain > 0) {
    const missing = playerMaxHp - playerHp
    score += Math.min(hpGain, missing) * 1.5
  }

  // Free relic — score using codex when a relic name is available, else flat bonus
  if ((relicName || descLower.includes('relic') || descLower.includes('obtain a relic')) && goldCost === 0) {
    if (relicName && deckAnalysis && archPrimary !== 'balanced') {
      // Use codex-informed relic scoring via codexRelicScore passed in (computed in caller)
      score += codexRelicScore ?? 20
    } else {
      score += 20
    }
  }

  // Card removal — excellent deck quality improvement
  if (descLower.includes('remove') && descLower.includes('card') && !descLower.includes('random')) {
    score += 18
    if (weaknesses.some(w => w.type === 'curse-heavy')) score += 10
  }

  // Free upgrade — good
  if (descLower.includes('upgrade') && goldCost === 0 && hpLoss === 0) {
    score += 14
  }

  // Gold gain — proportional value
  if (goldGain > 0) score += Math.min(goldGain / 10, 10)

  // Gold cost — proportional penalty
  if (goldCost > 0) score -= Math.min(goldCost / 15, 10)

  // Curse in deck — bad
  if (descLower.includes('curse') || (descLower.includes('add') && descLower.includes('curse'))) {
    score -= 20
  }

  // Archetype-specific bonuses (reward options that synergise with current build)
  const archBonus = buildArchetypeBonus(descLower, archPrimary, weaknesses, deckAnalysis)
  score += archBonus

  return Math.max(0, Math.min(100, score))
}

function buildArchetypeBonus(
  descLower: string,
  archPrimary: string,
  weaknesses: DeckAnalysis['weaknesses'],
  deckAnalysis: DeckAnalysis | null,
): number {
  let bonus = 0

  // Weakness addressing — bigger bonus because it plugs a real gap
  if (weaknesses.some(w => w.type === 'no-aoe') && descLower.includes('aoe')) bonus += 12
  if (weaknesses.some(w => w.type === 'no-scaling') && (descLower.includes('strength') || descLower.includes('scale'))) bonus += 12
  if (weaknesses.some(w => w.type === 'no-draw') && descLower.includes('draw')) bonus += 12
  if (weaknesses.some(w => w.type === 'curse-heavy') && descLower.includes('remove')) bonus += 15

  // Archetype synergies
  if (archPrimary === 'strength-scaling' && (descLower.includes('strength') || descLower.includes('power'))) bonus += 8
  if (archPrimary === 'block-turtle' && descLower.includes('dexterity')) bonus += 8
  if (archPrimary === 'poison' && descLower.includes('poison')) bonus += 8
  if (archPrimary === 'exhaust' && descLower.includes('exhaust')) bonus += 8
  if (archPrimary === 'orb-focus' && (descLower.includes('orb') || descLower.includes('focus') || descLower.includes('channel'))) bonus += 8
  if (archPrimary === 'shiv' && (descLower.includes('shiv') || descLower.includes('dagger'))) bonus += 8
  if (archPrimary === 'discard' && descLower.includes('discard') && !descLower.includes('random')) bonus += 8
  if (archPrimary === 'draw-engine' && descLower.includes('draw')) bonus += 8

  // Deck needs: if small deck, card additions are better; if large deck, removal is better
  const totalCards = deckAnalysis?.totalCards ?? 0
  if (totalCards > 20 && descLower.includes('remove')) bonus += 8
  if (totalCards < 10 && (descLower.includes('add') && descLower.includes('card'))) bonus += 5

  return bonus
}

// ─── Main analyzeEvent ─────────────────────────────────────────────────────────

export function analyzeEvent(
  state: GameState,
  codex: CodexData,
  deckAnalysis: DeckAnalysis | null,
  archetype: DeckArchetype | null,
): EventAnalysis | null {
  if (!state.event || !state.player) return null

  const ev = state.event
  const isAncient = ev.is_ancient ?? false
  const playerGold = state.player.gold
  const playerHp = state.player.hp
  const playerMaxHp = state.player.max_hp
  const hpPct = playerHp / playerMaxHp
  const act = state.run?.act ?? 1
  const playerRelics = state.player.relics ?? []

  // Relic modifiers for events
  const hasSsserpentHead = playerRelics.some(r => r.name?.toLowerCase().includes('ssserpent head') || r.name?.toLowerCase().includes('serpent head'))
  const hasMawBank = playerRelics.some(r => r.name?.toLowerCase().includes('maw bank'))
  const hasBloodyIdol = playerRelics.some(r => r.name?.toLowerCase().includes('bloody idol'))
  const hasPear = playerRelics.some(r => r.name?.toLowerCase().includes('pear'))
  const hasDuVuDoll = playerRelics.some(r => r.name?.toLowerCase().includes('du-vu doll') || r.name?.toLowerCase().includes('duvu'))

  const weaknesses = deckAnalysis?.weaknesses ?? []
  const archPrimary = archetype?.primary ?? 'balanced'

  const optionAnalyses: EventOptionAnalysis[] = (ev.options ?? []).map(option => {
    const title = option.title ?? ''
    const desc = option.description ?? ''
    const descLower = desc.toLowerCase()
    const titleLower = title.toLowerCase()
    const goldCost = parseGoldCost(desc)
    const goldGain = parseGoldGain(desc)
    const hpLoss = parseHpLoss(desc)
    const maxHpLoss = parseMaxHpLoss(desc)
    const hpGain = parseHpGain(desc)
    const maxHpGain = parseMaxHpGain(desc)
    const canAfford = goldCost === 0 || playerGold >= goldCost
    const relicName = option.relic_name ?? ''

    let recommendation: 'take' | 'avoid' | 'situational' = 'situational'
    let reason = ''

    // ── Locked ───────────────────────────────────────────────────────────
    if (option.is_locked) {
      return {
        optionId: String(option.index),
        label: title,
        outcomes: [desc],
        recommendation: 'avoid' as const,
        reason: 'Locked — requirements not met',
        isLocked: true,
        isProceed: false,
        goldCost,
      }
    }

    // ── Proceed/leave — always neutral ───────────────────────────────────
    if (option.is_proceed) {
      return {
        optionId: String(option.index),
        label: title,
        outcomes: [desc],
        recommendation: 'situational' as const,
        reason: 'Continue without choosing',
        isLocked: false,
        isProceed: true,
        goldCost: 0,
      }
    }

    // ── Ancient / Neow bonus ──────────────────────────────────────────────
    if (isAncient) {
      return analyzeAncientOption(
        option.index, title, desc, descLower, relicName,
        deckAnalysis, archPrimary, weaknesses, hpPct, act,
        maxHpGain, maxHpLoss, hpLoss, hpGain,
        playerHp, playerMaxHp,
      )
    }

    // ── Standard event logic ──────────────────────────────────────────────

    // Cannot afford — hard avoid
    if (goldCost > 0 && !canAfford) {
      return {
        optionId: String(option.index),
        label: title,
        outcomes: [desc],
        recommendation: 'avoid',
        reason: `Cannot afford — needs ${goldCost}g, you have ${playerGold}g`,
        isLocked: false,
        isProceed: false,
        goldCost,
        score: 0,
      }
    }

    // ── Max HP loss options (permanent — always treated specially) ────────
    if (maxHpLoss > 0) {
      const hpAfterMax = playerMaxHp - maxHpLoss
      const currentHpLoss = hpLoss - maxHpLoss  // additional current HP loss beyond max HP
      const hpAfterCurrent = playerHp - currentHpLoss
      const hpAfterPct = hpAfterCurrent / hpAfterMax

      const bloodyNote = hasBloodyIdol ? ` (Bloody Idol: +${hpLoss}g)` : ''

      if (hpAfterMax < 30) {
        recommendation = 'avoid'
        reason = `Loses ${maxHpLoss} Max HP permanently — Max HP would drop to ${hpAfterMax}. Too dangerous${bloodyNote}`
      } else if (relicName || descLower.includes('relic')) {
        recommendation = hpPct >= 0.7 && hpAfterMax >= 50 ? 'situational' : 'avoid'
        reason = `Relic for -${maxHpLoss} Max HP (permanent) — Max HP drops to ${hpAfterMax}${bloodyNote}`
      } else if (descLower.includes('upgrade')) {
        recommendation = 'avoid'
        reason = `Upgrade for -${maxHpLoss} Max HP (permanent) — not worth the permanent loss${bloodyNote}`
      } else {
        recommendation = 'avoid'
        reason = `Loses ${maxHpLoss} Max HP permanently (Max HP: ${playerMaxHp} → ${hpAfterMax})${bloodyNote}`
      }
      if (hpAfterPct < 0.15) {
        recommendation = 'avoid'
        reason = `Would leave you at ${hpAfterCurrent}/${hpAfterMax} HP (${Math.round(hpAfterPct * 100)}%) — extremely dangerous`
      }
    }

    // ── Current HP loss options (temporary) ──────────────────────────────
    else if (hpLoss > 0) {
      const hpAfter = playerHp - hpLoss
      const hpAfterPct = hpAfter / playerMaxHp
      const bloodyNote = hasBloodyIdol ? ` (Bloody Idol: +${hpLoss}g from HP loss)` : ''

      if (hpAfterPct < 0.15) {
        recommendation = 'avoid'
        reason = `Loses ${hpLoss} HP — would leave you at ${hpAfter} HP (${Math.round(hpAfterPct * 100)}%)`
      } else if (relicName || descLower.includes('relic')) {
        recommendation = hpPct >= 0.6 ? 'take' : 'situational'
        reason = hpPct >= 0.6
          ? `Gain relic for ${hpLoss} HP — good trade at your current HP${bloodyNote}`
          : `Relic for ${hpLoss} HP — low HP risk (${Math.round(hpPct * 100)}%)${bloodyNote}`
      } else if (descLower.includes('upgrade') && hpLoss <= 6) {
        recommendation = 'situational'
        reason = `Card upgrade for ${hpLoss} HP — decent if HP comfortable${bloodyNote}`
      } else if (descLower.includes('gold') || descLower.includes('card')) {
        recommendation = hpPct >= 0.5 ? 'situational' : 'avoid'
        reason = hpPct >= 0.5
          ? `Resources for ${hpLoss} HP — situational${bloodyNote}`
          : `Low HP (${Math.round(hpPct * 100)}%) — avoid spending HP`
      } else {
        recommendation = 'avoid'
        reason = `Loses ${hpLoss} HP — unclear upside${bloodyNote}`
      }
    }

    // ── Max HP gain ───────────────────────────────────────────────────────
    else if (maxHpGain > 0 && goldCost === 0) {
      recommendation = 'take'
      reason = `Gain +${maxHpGain} Max HP permanently (${playerMaxHp} → ${playerMaxHp + maxHpGain})`
    }

    // ── Current HP gain ───────────────────────────────────────────────────
    else if (hpGain > 0 && goldCost === 0) {
      const effectiveGain = hasPear ? hpGain + 3 : hpGain
      recommendation = hpPct < 0.9 ? 'take' : 'situational'
      reason = hpPct < 0.9
        ? `${hasPear ? 'Pear: ' : ''}Heal +${effectiveGain} HP (${playerHp} → ${Math.min(playerMaxHp, playerHp + effectiveGain)})`
        : `Already near full HP — ${effectiveGain} HP gain less impactful`
    }

    // ── Gold cost options ─────────────────────────────────────────────────
    else if (goldCost > 0) {
      const isGoodDeal = descLower.includes('relic') || descLower.includes('upgrade') || relicName
      const goldRatio = playerGold / goldCost
      const goldBonus = hasSsserpentHead && descLower.includes('gold') ? 50 : 0
      const mawNote = hasMawBank && descLower.includes('gold') ? ' (Maw Bank bonus)' : ''

      if (isGoodDeal && goldRatio >= 2) {
        recommendation = 'take'
        reason = `Good deal — ${goldCost}g for ${relicName || 'reward'} (you have ${playerGold}g)${mawNote}`
      } else if (isGoodDeal) {
        recommendation = 'situational'
        reason = `${goldCost}g for ${relicName || 'reward'} — watch your gold budget`
      } else {
        recommendation = goldRatio >= 2 ? 'situational' : 'avoid'
        reason = `Costs ${goldCost}g — ${goldRatio >= 2 ? 'can afford' : 'tight on gold'}`
        if (goldBonus > 0) reason += ` (Ssserpent Head: +${goldBonus} gold if this gives gold)`
      }
    }

    // ── Curse options ─────────────────────────────────────────────────────
    else if (descLower.includes('curse') || (descLower.includes('add') && descLower.includes('curse'))) {
      const hasCurseHeavy = weaknesses.some(w => w.type === 'curse-heavy')
      if (hasDuVuDoll) {
        recommendation = 'take'
        reason = `Du-Vu Doll: each curse grants +1 Strength — curse options become valuable`
      } else if (relicName || descLower.includes('relic')) {
        recommendation = 'situational'
        reason = `Gain ${relicName || 'relic'} but receive a curse — weigh relic quality`
      } else {
        recommendation = 'avoid'
        reason = hasCurseHeavy ? 'Adds a curse — deck already curse-heavy' : 'Adds a curse — generally bad'
      }
    }

    // ── Free resources ────────────────────────────────────────────────────
    else if (relicName || descLower.includes('relic') || descLower.includes('obtain a relic')) {
      recommendation = 'take'
      reason = `Free relic${relicName ? `: ${relicName}` : ''}`
    } else if (goldGain > 0 && !descLower.includes('lose')) {
      recommendation = 'take'
      reason = `Gain ${goldGain} gold at no cost`
    } else if (descLower.includes('gold') && !descLower.includes('lose')) {
      recommendation = 'take'
      reason = 'Gains gold at no cost'
    } else if (descLower.includes('upgrade') && goldCost === 0 && hpLoss === 0) {
      recommendation = hasUpgradeableCards(deckAnalysis) ? 'take' : 'situational'
      reason = hasUpgradeableCards(deckAnalysis)
        ? `Free upgrade — use on ${getBestUpgradeTarget(deckAnalysis)}`
        : 'Free upgrade — limited deck options'
    } else if (descLower.includes('add') && descLower.includes('card') && !descLower.includes('curse')) {
      recommendation = 'situational'
      reason = 'Adds a card — assess if it fits your build'
    } else if (descLower.includes('remove') && descLower.includes('card')) {
      recommendation = 'take'
      reason = 'Free card removal — deck thinning is always valuable'
    }

    // ── Leave/skip ────────────────────────────────────────────────────────
    else if (titleLower.includes('leave') || titleLower.includes('skip') || titleLower === 'ignore') {
      recommendation = 'situational'
      reason = 'Safe exit — no cost, no benefit'
    }

    // Deck-weakness-aware reason enhancement
    if (recommendation === 'situational' || recommendation === 'take') {
      const enhanced = enhanceWithDeckContext(descLower, reason, weaknesses, archPrimary)
      if (enhanced !== reason) reason = enhanced
    }

    // Compute codex-informed relic score when this option grants a relic
    let codexRelicScore: number | undefined
    if (relicName && deckAnalysis && archetype && goldCost === 0) {
      const deck = state.player?.draw_pile ?? []
      const lookupName = relicName.toLowerCase()
      const codexRelic = codex.relicByName?.get(lookupName)
      if (codexRelic) {
        const fakeRelic = { id: codexRelic.id, name: codexRelic.name, description: codexRelic.description }
        const evals = evaluateRelics([fakeRelic], deck, playerRelics, codex, archetype, [], act)
        if (evals.length > 0) {
          // Map 1-10 score to 5-35 event score range (baseline 20 for an unknown free relic)
          codexRelicScore = Math.round((evals[0].score / 10) * 35)
        }
      }
    }

    // Compute numeric score for ranking
    const score = scoreOption(
      recommendation, descLower, relicName,
      hpLoss, maxHpLoss, maxHpGain, hpGain,
      goldCost, goldGain,
      playerHp, playerMaxHp,
      archPrimary, weaknesses, deckAnalysis,
      codexRelicScore,
    )

    return {
      optionId: String(option.index),
      label: title,
      outcomes: [desc],
      recommendation,
      reason,
      isLocked: false,
      isProceed: false,
      goldCost,
      score,
    }
  })

  // ── Rank and mark the single best pick ───────────────────────────────────────
  const rankable = optionAnalyses.filter(o => !o.isLocked && !o.isProceed && o.score !== undefined)
  if (rankable.length > 1) {
    const sorted = [...rankable].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    const topScore = sorted[0].score ?? 0
    const secondScore = sorted[1]?.score ?? 0
    // Only mark "best" when there is a meaningful difference (≥8 points) from second-best
    // or when the top option is the only 'take' — avoids misleading "BEST" on trivially equal picks
    const hasGap = topScore - secondScore >= 8
    const onlyTake = rankable.filter(o => o.recommendation === 'take').length === 1 && sorted[0].recommendation === 'take'
    if (hasGap || onlyTake) {
      const bestIdx = optionAnalyses.findIndex(o => o.optionId === sorted[0].optionId)
      if (bestIdx >= 0) optionAnalyses[bestIdx].isBest = true
    }
  } else if (rankable.length === 1) {
    const idx = optionAnalyses.findIndex(o => o.optionId === rankable[0].optionId)
    if (idx >= 0 && rankable[0].recommendation !== 'avoid') optionAnalyses[idx].isBest = true
  }

  const bestOption = optionAnalyses.find(o => o.isBest)

  // ── Build summary ─────────────────────────────────────────────────────────────
  const topRec = optionAnalyses.filter(o => !o.isLocked && !o.isProceed)
  const allAvoid = topRec.every(o => o.recommendation === 'avoid')
  const hasTake = topRec.some(o => o.recommendation === 'take')

  let summary: string
  if (isAncient) {
    summary = bestOption
      ? `Ancient Bonus — best pick: "${bestOption.label}"`
      : 'Ancient Bonus — choose your starting gift'
  } else if (allAvoid) {
    summary = `${ev.event_name} — all options unfavorable, skip if possible`
  } else if (bestOption) {
    summary = `${ev.event_name} — best pick: "${bestOption.label}"`
  } else if (hasTake) {
    const best = topRec.find(o => o.recommendation === 'take')!
    summary = `${ev.event_name} — take "${best.label}"`
  } else {
    summary = `${ev.event_name} — situational choices, read carefully`
  }

  return {
    eventId: ev.event_id,
    isAncient,
    optionAnalyses,
    summary,
    bestOptionLabel: bestOption?.label,
  }
}

// ─── Ancient/Neow option analysis ─────────────────────────────────────────────

function analyzeAncientOption(
  index: number,
  title: string,
  desc: string,
  descLower: string,
  relicName: string,
  deckAnalysis: DeckAnalysis | null,
  archPrimary: string,
  weaknesses: DeckAnalysis['weaknesses'],
  hpPct: number,
  act: number,
  maxHpGain: number,
  maxHpLoss: number,
  hpLoss: number,
  hpGain: number,
  playerHp: number,
  playerMaxHp: number,
): EventOptionAnalysis {
  let recommendation: 'take' | 'avoid' | 'situational' = 'situational'
  let reason = desc
  let score = 30 // default situational

  // ── Max HP loss — must check BEFORE generic "max hp" gain detection ──────────
  if (maxHpLoss > 0) {
    const afterMaxHp = playerMaxHp - maxHpLoss
    if (relicName || descLower.includes('boss relic')) {
      recommendation = afterMaxHp >= 55 ? 'situational' : 'avoid'
      reason = `Gives ${relicName || 'boss relic'} but costs -${maxHpLoss} Max HP permanently (${playerMaxHp} → ${afterMaxHp})`
      score = afterMaxHp >= 55 ? 35 : 10
    } else {
      recommendation = 'avoid'
      reason = `Loses ${maxHpLoss} Max HP permanently (${playerMaxHp} → ${afterMaxHp}) — long-term damage to survivability`
      score = 5
    }

  // ── Max HP gain ──────────────────────────────────────────────────────────────
  } else if (maxHpGain > 0) {
    recommendation = 'take'
    reason = `Gain +${maxHpGain} Max HP permanently (${playerMaxHp} → ${playerMaxHp + maxHpGain}) — excellent long-term value`
    score = 80

  // ── Free upgrade ─────────────────────────────────────────────────────────────
  } else if (descLower.includes('upgrade') && !descLower.includes('curse') && hpLoss === 0) {
    recommendation = 'take'
    reason = hasUpgradeableCards(deckAnalysis)
      ? `Free upgrade — use on ${getBestUpgradeTarget(deckAnalysis)}`
      : 'Upgrade a card — valuable opening gift'
    score = 75

  // ── Add 3 cards ───────────────────────────────────────────────────────────────
  } else if (descLower.includes('3 cards')) {
    recommendation = 'take'
    reason = 'Add 3 cards to your deck — choose carefully for build'
    score = 65

  // ── Card removal ─────────────────────────────────────────────────────────────
  } else if (descLower.includes('remove') && !descLower.includes('random')) {
    recommendation = 'take'
    reason = 'Remove a starting card — excellent deck thinning'
    score = 80

  // ── Boss relic or named relic (with no HP cost) ──────────────────────────────
  } else if ((relicName || descLower.includes('boss relic')) && maxHpLoss === 0 && hpLoss === 0) {
    recommendation = 'take'
    reason = `Boss relic or powerful relic: ${relicName || 'inspect carefully'}`
    score = 85

  // ── Transform 2 cards ────────────────────────────────────────────────────────
  } else if (descLower.includes('transform 2')) {
    recommendation = 'situational'
    reason = 'Transforms 2 starting cards — high variance, situational'
    score = 35

  // ── Permanent Strength / Dexterity ───────────────────────────────────────────
  } else if (descLower.includes('strength') && !descLower.includes('lose')) {
    recommendation = archPrimary === 'strength-scaling' ? 'take' : 'situational'
    reason = archPrimary === 'strength-scaling'
      ? 'Permanent Strength — excellent for your Strength build'
      : 'Permanent Strength — good but not your core archetype'
    score = archPrimary === 'strength-scaling' ? 78 : 55

  } else if (descLower.includes('dexterity') && !descLower.includes('lose')) {
    recommendation = archPrimary === 'block-turtle' ? 'take' : 'situational'
    reason = archPrimary === 'block-turtle'
      ? 'Permanent Dexterity — excellent for your Block build'
      : 'Permanent Dexterity — good but not your core archetype'
    score = archPrimary === 'block-turtle' ? 78 : 55

  // ── Curse + boss relic (high risk/reward) ────────────────────────────────────
  } else if (descLower.includes('random boss relic') && descLower.includes('curse')) {
    recommendation = act <= 1 ? 'take' : 'situational'
    reason = 'Random boss relic + a Curse — powerful early, risky late'
    score = act <= 1 ? 65 : 40

  // ── Standalone curse (bad) ────────────────────────────────────────────────────
  } else if (descLower.includes('curse') && !descLower.includes('boss relic') && !relicName) {
    recommendation = 'avoid'
    reason = 'Adds a curse — generally bad opening choice'
    score = 5

  // ── Gold rewards ──────────────────────────────────────────────────────────────
  } else if (descLower.includes('100 gold')) {
    recommendation = 'take'
    reason = '100 gold — strong early-game buy power'
    score = 65
  } else if (descLower.includes('50 gold')) {
    recommendation = 'situational'
    reason = '50 gold — decent, but better options usually available'
    score = 40

  // ── Current HP heal ───────────────────────────────────────────────────────────
  } else if (hpGain > 0 && hpLoss === 0) {
    recommendation = hpPct < 0.8 ? 'take' : 'situational'
    reason = hpPct < 0.8
      ? `Heal +${hpGain} HP — valuable at your current HP`
      : `+${hpGain} HP — less impactful near full HP`
    score = hpPct < 0.8 ? 60 : 35
  }

  // Apply archetype bonus to the score
  score = Math.min(100, score + buildArchetypeBonus(descLower, archPrimary, weaknesses, deckAnalysis))

  return {
    optionId: String(index),
    label: title,
    outcomes: [desc],
    recommendation,
    reason,
    isLocked: false,
    isProceed: false,
    goldCost: 0,
    score,
  }
}

// ─── Deck context helpers ─────────────────────────────────────────────────────

function hasUpgradeableCards(deckAnalysis: DeckAnalysis | null): boolean {
  return (deckAnalysis?.totalCards ?? 0) > 5
}

function getBestUpgradeTarget(deckAnalysis: DeckAnalysis | null): string {
  if (!deckAnalysis) return 'a key card'
  const arch = deckAnalysis.archetype.primary
  const suggestions: Record<string, string> = {
    'strength-scaling': 'Inflame or Limit Break',
    'block-turtle': 'Barricade or Entrench',
    'exhaust': 'Corruption or Feel No Pain',
    'poison': 'Catalyst or Noxious Fumes',
    'orb-focus': 'Defragment or Electrodynamics',
    'shiv': 'Accuracy or Blade Dance',
    'discard': 'Wraith Form or Tactician',
    'draw-engine': 'Adrenaline or Expertise',
  }
  return suggestions[arch] ?? 'your best card'
}

function enhanceWithDeckContext(
  descLower: string,
  currentReason: string,
  weaknesses: DeckAnalysis['weaknesses'],
  archPrimary: string,
): string {
  if (weaknesses.some(w => w.type === 'no-aoe') && descLower.includes('aoe'))
    return `${currentReason} — fills AoE weakness in your deck`
  if (weaknesses.some(w => w.type === 'no-scaling') && (descLower.includes('strength') || descLower.includes('scale')))
    return `${currentReason} — addresses your deck's scaling weakness`
  if (weaknesses.some(w => w.type === 'no-draw') && descLower.includes('draw'))
    return `${currentReason} — addresses your deck's draw weakness`
  if (weaknesses.some(w => w.type === 'curse-heavy') && descLower.includes('remove'))
    return `${currentReason} — removes curse from your deck!`
  if (archPrimary === 'exhaust' && descLower.includes('exhaust'))
    return `${currentReason} — Exhaust synergy fits your build`
  if (archPrimary === 'discard' && descLower.includes('discard') && !descLower.includes('random'))
    return `${currentReason} — Discard synergy fits your build`
  if (archPrimary === 'poison' && descLower.includes('poison'))
    return `${currentReason} — Poison synergy fits your build`
  if (archPrimary === 'strength-scaling' && (descLower.includes('strength') || descLower.includes('power')))
    return `${currentReason} — Strength scaling fits your build`
  if (archPrimary === 'orb-focus' && (descLower.includes('orb') || descLower.includes('channel') || descLower.includes('focus')))
    return `${currentReason} — Orb synergy fits your build`
  if (archPrimary === 'draw-engine' && descLower.includes('draw'))
    return `${currentReason} — Draw engine synergy fits your build`
  if (archPrimary === 'shiv' && (descLower.includes('shiv') || descLower.includes('dagger')))
    return `${currentReason} — Shiv synergy fits your build`
  if (archPrimary === 'discard' && descLower.includes('discard') && descLower.includes('random'))
    return `${currentReason} — Warning: random discard can disrupt your combos`
  return currentReason
}
