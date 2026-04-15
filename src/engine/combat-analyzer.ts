import type { GameState, Enemy, PlayerState, ActivePower } from '@/types/game-state'
import { parseIntentDamage, getEncounterType } from '@/types/game-state'
import type { CodexData } from '@/types/codex'
import type { CombatAdvice, CombatBuildLensId, CombatTurn, DeckArchetype, EnemyThreatLevel, EncounterType } from '@/types/advisor'
import { predictNextMove } from '@/utils/pattern-parser'
import { planCombatAdvice } from './combat-planner'
import { getBossContext } from './boss-advisor'
import { getEliteContext } from './elite-advisor'

function applyVulnerable(damage: number, playerPowers: ActivePower[] | null | undefined): number {
  const vulnerable = (playerPowers ?? []).find(power => power.id?.toLowerCase().includes('vulnerable'))
  return vulnerable && vulnerable.amount > 0 ? Math.floor(damage * 1.5) : damage
}

function applyWeak(damage: number, enemyPowers: ActivePower[] | null | undefined): number {
  const weak = (enemyPowers ?? []).find(power => power.id?.toLowerCase().includes('weak'))
  return weak && weak.amount > 0 ? Math.floor(damage * 0.75) : damage
}

function getEnemyTotalDamage(enemy: Enemy, playerPowers: ActivePower[] | null | undefined): number {
  let total = 0
  for (const intent of (enemy.intents ?? [])) {
    const parsed = parseIntentDamage(intent)
    if (!parsed) continue
    let damage = parsed.damage
    damage = applyWeak(damage, enemy.status)
    damage = applyVulnerable(damage, playerPowers)
    const strength = (enemy.status ?? []).find(power => power.id?.toLowerCase().includes('strength'))
    if (strength && strength.amount > 0) damage += strength.amount
    total += Math.max(0, damage) * parsed.times
  }
  return total
}

function buildCurrentTurn(enemies: Enemy[], player: PlayerState): CombatTurn {
  const sources = enemies.map(enemy => ({
    enemyName: enemy.name,
    damage: getEnemyTotalDamage(enemy, player.status ?? []),
    moveType: enemy.intents[0]?.type ?? 'unknown',
  }))
  const totalIncoming = sources.reduce((sum, source) => sum + source.damage, 0)
  const totalDamage = Math.max(0, totalIncoming - player.block)
  const blockNeeded = Math.max(0, totalIncoming - player.block)
  return {
    totalDamage,
    sources,
    isLethal: totalDamage >= player.hp,
    blockNeeded,
  }
}

function orbPassiveDamage(state: GameState): number {
  return (state.player?.orbs ?? []).reduce((sum, orb) => sum + (orb.passive_val ?? 0), 0)
}

function buildNextTurnPreview(state: GameState, codex: CodexData): CombatTurn | null {
  const player = state.player
  const enemies = state.battle?.enemies
  if (!player || !enemies) return null

  try {
    const predictedEnemies: Enemy[] = enemies.map(enemy => {
      const monster = codex.monsterById.get(enemy.entity_id)
      if (!monster?.attack_pattern || !monster.moves) return enemy
      const currentMoveId = enemy.intents[0]?.title ?? enemy.intents[0]?.type ?? ''
      const nextMove = predictNextMove(monster.attack_pattern, currentMoveId, monster.moves)
      if (!nextMove) return enemy

      const predictedIntent = {
        type: nextMove.intent ?? 'Attack',
        label: nextMove.damage
          ? `${nextMove.damage.normal}${(nextMove.damage.hit_count ?? 1) > 1 ? `x${nextMove.damage.hit_count}` : ''}`
          : '',
      }

      return {
        ...enemy,
        block: 0,
        intents: [predictedIntent],
      }
    })

    return buildCurrentTurn(predictedEnemies, { ...player, block: 0 })
  } catch {
    return null
  }
}

function getThreatLevel(totalDamage: number, hp: number): EnemyThreatLevel {
  if (totalDamage >= hp) return 'lethal'
  const ratio = totalDamage / hp
  if (ratio >= 0.5) return 'high'
  if (ratio >= 0.25) return 'medium'
  return 'low'
}

/** Build context-aware notes about active buffs, debuffs, and conditional card effects */
function buildActiveEffectNotes(state: GameState): string[] {
  const notes: string[] = []
  const player = state.player!
  const playerStatus = player.status ?? []
  const enemies = state.battle?.enemies ?? []
  const hand = player.hand ?? []

  // ── Player debuffs that constrain play ──────────────────────────────────────
  const frail = playerStatus.find(p => p.id?.toLowerCase().includes('frail') && (p.amount ?? 0) > 0)
  if (frail) notes.push(`Frail (${frail.amount} turns): block cards generate 25% less block`)

  const weak = playerStatus.find(p => p.id?.toLowerCase().includes('weak') && (p.amount ?? 0) > 0)
  if (weak) notes.push(`Weak (${weak.amount} turns): attacks deal 25% less damage`)

  const vulnerable = playerStatus.find(p => p.id?.toLowerCase().includes('vulnerable') && (p.amount ?? 0) > 0)
  if (vulnerable) notes.push(`Vulnerable (${vulnerable.amount} turns): you take 50% more damage`)

  const noDraw = playerStatus.find(p =>
    p.id?.toLowerCase().includes('no draw') || p.id?.toLowerCase().includes('no_draw') ||
    p.name?.toLowerCase().includes('no draw')
  )
  if (noDraw) notes.push('No Draw: cannot draw cards this turn')

  const constricted = playerStatus.find(p => p.id?.toLowerCase().includes('constrict') && (p.amount ?? 0) > 0)
  if (constricted) notes.push(`Constricted (${constricted.amount} turns): you can only play ${constricted.amount} card(s) per turn`)

  const hex = playerStatus.find(p => p.id?.toLowerCase().includes('hex') && (p.amount ?? 0) > 0)
  if (hex) notes.push('Hex: playing a non-Attack adds a Dazed to your draw pile')

  // ── Player buffs worth calling out ──────────────────────────────────────────
  const artifact = playerStatus.find(p => p.id?.toLowerCase().includes('artifact') && (p.amount ?? 0) > 0)
  if (artifact) notes.push(`Artifact (${artifact.amount} stacks): next ${artifact.amount} debuff(s) are blocked`)

  const intangible = playerStatus.find(p => p.id?.toLowerCase().includes('intangible') && (p.amount ?? 0) > 0)
  if (intangible) notes.push('Intangible: all damage reduced to 1 this turn')

  const juggernaut = playerStatus.find(p => p.id?.toLowerCase().includes('juggernaut') && (p.amount ?? 0) > 0)
  if (juggernaut) notes.push(`Juggernaut: each block card deals ${juggernaut.amount} damage to a random enemy`)

  const rupture = playerStatus.find(p => p.id?.toLowerCase().includes('rupture') && (p.amount ?? 0) > 0)
  if (rupture) notes.push(`Rupture: losing HP from cards grants ${rupture.amount} Strength`)

  const metallicize = playerStatus.find(p => p.id?.toLowerCase().includes('metallicize') && (p.amount ?? 0) > 0)
  if (metallicize) notes.push(`Metallicize: gain ${metallicize.amount} block at end of each turn`)

  const thorns = playerStatus.find(p => p.id?.toLowerCase().includes('thorns') && (p.amount ?? 0) > 0)
  if (thorns) notes.push(`Thorns: deal ${thorns.amount} damage to attackers`)

  // ── Enemy buffs that affect combat strategy ─────────────────────────────────
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue
    const enemyStatus = enemy.status ?? []
    const prefix = enemies.filter(e => e.hp > 0).length > 1 ? `${enemy.name}: ` : ''

    const enemyThorns = enemyStatus.find(p => p.id?.toLowerCase().includes('thorns') && (p.amount ?? 0) > 0)
    if (enemyThorns) notes.push(`${prefix}Thorns ${enemyThorns.amount} — each attack hits you back for ${enemyThorns.amount} damage`)

    const enemyMet = enemyStatus.find(p => p.id?.toLowerCase().includes('metallicize') && (p.amount ?? 0) > 0)
    if (enemyMet) notes.push(`${prefix}Metallicize — gains ${enemyMet.amount} block each turn; kill fast or use Weak`)

    const enemyRegen = enemyStatus.find(p =>
      (p.id?.toLowerCase().includes('regen') || p.id?.toLowerCase().includes('regenerate')) && (p.amount ?? 0) > 0
    )
    if (enemyRegen) notes.push(`${prefix}Regeneration — heals ${enemyRegen.amount} HP per turn; prioritise burst damage`)

    const enemyStr = enemyStatus.find(p => p.id?.toLowerCase().includes('strength') && (p.amount ?? 0) > 0)
    if (enemyStr && enemyStr.amount > 2) notes.push(`${prefix}Strength ${enemyStr.amount} — incoming damage elevated; Weak recommended`)

    const enemyAngered = enemyStatus.find(p => p.id?.toLowerCase().includes('anger') && (p.amount ?? 0) > 0)
    if (enemyAngered) notes.push(`${prefix}Angered — gains Strength when you play Attacks`)

    const enemySpore = enemyStatus.find(p => p.id?.toLowerCase().includes('spore') || p.id?.toLowerCase().includes('split'))
    if (enemySpore) notes.push(`${prefix}May split/spawn — finish quickly or prepare for adds`)
  }

  // ── Ethereal card warnings ──────────────────────────────────────────────────
  for (const card of hand) {
    if (card.can_play === false) continue
    const isEthereal = (card.keywords ?? []).some(k => k.name?.toLowerCase() === 'ethereal') ||
      card.description?.toLowerCase().includes('ethereal')
    if (isEthereal) notes.push(`"${card.name}" is Ethereal — play it this turn or it exhausts`)
  }

  // ── Multi-turn card effect reminders from player powers ──────────────────────
  const flex = playerStatus.find(p => p.name?.toLowerCase() === 'flex' && (p.amount ?? 0) > 0)
  if (flex) notes.push(`Flex: +${flex.amount} temporary Strength — use attacks now, it wears off next turn`)

  const combust = playerStatus.find(p => p.id?.toLowerCase().includes('combust') && (p.amount ?? 0) > 0)
  if (combust) notes.push(`Combust: lose ${combust.amount} HP at end of turn, deal ${combust.amount * 5} damage to all enemies`)

  return notes
}

/** Determine priority target in multi-enemy fights */
function buildPriorityTarget(enemies: import('@/types/game-state').Enemy[]): string | undefined {
  const alive = enemies.filter(e => e.hp > 0)
  if (alive.length <= 1) return undefined

  // Priority 1: enemy with Regeneration (kills the benefit of not finishing them)
  const regenEnemy = alive.find(e =>
    (e.status ?? []).some(p =>
      (p.id?.toLowerCase().includes('regen') || p.id?.toLowerCase().includes('regenerate')) && (p.amount ?? 0) > 0
    )
  )
  if (regenEnemy) return `${regenEnemy.name} (has Regeneration — kill first)`

  // Priority 2: enemy with highest intent damage (biggest threat)
  const sorted = [...alive].sort((a, b) => {
    const dmgA = a.intents.reduce((sum, intent) => {
      const parsed = parseIntentDamage(intent)
      return sum + (parsed ? parsed.damage * parsed.times : 0)
    }, 0)
    const dmgB = b.intents.reduce((sum, intent) => {
      const parsed = parseIntentDamage(intent)
      return sum + (parsed ? parsed.damage * parsed.times : 0)
    }, 0)
    return dmgB - dmgA
  })

  // Priority 3: enemy closest to death (efficient kill)
  const killable = alive.find(e => e.hp < 20)
  if (killable && killable !== sorted[0]) {
    // If the most dangerous isn't also most killable, note both
    return `${sorted[0].name} (highest threat: ${sorted[0].intents[0]?.description ?? sorted[0].intents[0]?.type})`
  }

  if (sorted[0]) {
    return `${sorted[0].name} (highest threat)`
  }

  return undefined
}

export function analyzeCombat(
  state: GameState,
  codex: CodexData,
  archetype?: DeckArchetype,
  options: { selectedBuildLensId?: CombatBuildLensId } = {},
): CombatAdvice | null {
  if (!state.player || !state.battle) return null

  const currentTurn = buildCurrentTurn(state.battle.enemies ?? [], state.player)
  const nextTurnPreview = buildNextTurnPreview(state, codex)
  const planner = planCombatAdvice(
    state,
    codex,
    currentTurn,
    nextTurnPreview,
    archetype,
    { selectedBuildLensId: options.selectedBuildLensId ?? 'auto' },
  )

  let summary = planner.summary
  const orbDamage = orbPassiveDamage(state)
  if (!planner.candidateLines[0]?.survivesIncoming && currentTurn.isLethal) {
    summary = `Still lethal this turn: ${currentTurn.totalDamage} net incoming.`
  } else if (planner.candidateLines[0]?.survivesIncoming && currentTurn.isLethal) {
    summary = planner.summary
  } else if (planner.candidateLines[0]?.lethalNow) {
    summary = planner.summary
  } else if (currentTurn.totalDamage > 0) {
    summary = `${planner.summary}${orbDamage > 0 ? ` Orbs add ${orbDamage}/turn.` : ''}`
  } else if (orbDamage > 0) {
    summary = `${planner.summary} Orbs add ${orbDamage}/turn.`
  }

  // Encounter type and context
  const encounterType: EncounterType = getEncounterType(state.state_type) ?? 'monster'
  const threatLevel = getThreatLevel(currentTurn.totalDamage, state.player.hp)

  const allDeck = [
    ...(state.player.hand ?? []),
    ...(state.player.draw_pile ?? []),
    ...(state.player.discard_pile ?? []),
    ...(state.player.exhaust_pile ?? []),
  ]

  // Boss or elite specific context
  const primaryEnemyName = state.battle.enemies[0]?.name ?? ''
  const bossCtx = encounterType === 'boss' && archetype
    ? getBossContext(primaryEnemyName, allDeck, state.player.relics ?? [], archetype)
    : null
  const eliteCtx = encounterType === 'elite' && archetype
    ? getEliteContext(primaryEnemyName, archetype, allDeck)
    : null

  const activeEffectNotes = buildActiveEffectNotes(state)
  const priorityTarget = buildPriorityTarget(state.battle.enemies ?? [])

  return {
    combatKey: planner.combatKey,
    characterId: planner.characterId,
    encounterType,
    enemyThreatLevel: threatLevel,
    currentTurn,
    nextTurnPreview,
    isLethal: currentTurn.isLethal,
    candidateLines: planner.candidateLines,
    availableBuildLenses: planner.availableBuildLenses,
    selectedLineIndex: 0,
    selectedBuildLensId: planner.selectedBuildLensId,
    selectedBuildLensLabel: planner.selectedBuildLensLabel,
    autoBuildLensId: planner.autoBuildLensId,
    autoBuildLensLabel: planner.autoBuildLensLabel,
    suggestedPlay: planner.suggestedPlay,
    potionSuggestion: planner.potionSuggestion,
    summary,
    bossContext: bossCtx ?? undefined,
    eliteContext: eliteCtx ?? undefined,
    availableEnergy: state.player.energy,
    maxEnergy: state.player.max_energy,
    activeEffectNotes,
    priorityTarget,
  }
}
