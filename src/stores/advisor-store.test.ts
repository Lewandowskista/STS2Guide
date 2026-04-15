import { beforeEach, describe, expect, it } from 'vitest'
import { useAdvisorStore } from './advisor-store'
import type { CombatAdvice, CombatBuildLensId, CombatCandidateLine, PathScore } from '@/types/advisor'
import type { GameCard } from '@/types/game-state'

function makeCard(name: string): GameCard {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    cost: 1,
    type: 'Attack',
    target_type: 'AnyEnemy',
    can_play: true,
  }
}

function makeLine(label: string, priority: number): CombatCandidateLine {
  const card = makeCard(label)
  return {
    id: label.toLowerCase(),
    summary: `${label} summary`,
    score: 100 - priority,
    netIncomingDamage: 0,
    estimatedEnemyDamage: 10,
    estimatedBlock: 0,
    lethalNow: false,
    survivesIncoming: true,
    steps: [{
      type: 'card',
      label,
      reason: `${label} reason`,
      card,
      priority: 0,
    }],
    suggestedPlay: [{
      card,
      reason: `${label} reason`,
      priority: 0,
    }],
  }
}

function makeCombatAdvice(overrides: Partial<CombatAdvice> = {}): CombatAdvice {
  return {
    combatKey: overrides.combatKey ?? 'act1-floor1-round1',
    characterId: overrides.characterId ?? 'silent',
    currentTurn: overrides.currentTurn ?? {
      totalDamage: 8,
      sources: [{ enemyName: 'Enemy', damage: 8, moveType: 'Attack' }],
      isLethal: false,
      blockNeeded: 8,
    },
    nextTurnPreview: overrides.nextTurnPreview ?? null,
    isLethal: overrides.isLethal ?? false,
    summary: overrides.summary ?? 'Safe enough',
    potionSuggestion: overrides.potionSuggestion,
    suggestedPlay: overrides.suggestedPlay ?? [makeLine('Line 1', 0).suggestedPlay[0]],
    candidateLines: overrides.candidateLines ?? [makeLine('Line 1', 0), makeLine('Line 2', 1), makeLine('Line 3', 2)],
    availableBuildLenses: overrides.availableBuildLenses ?? [
      { id: 'auto', label: 'Auto' },
      { id: 'poison', label: 'Poison' },
      { id: 'shiv', label: 'Shiv' },
    ],
    selectedLineIndex: overrides.selectedLineIndex ?? 0,
    selectedBuildLensId: overrides.selectedBuildLensId ?? 'auto',
    selectedBuildLensLabel: overrides.selectedBuildLensLabel ?? 'Auto',
    autoBuildLensId: overrides.autoBuildLensId ?? 'poison',
    autoBuildLensLabel: overrides.autoBuildLensLabel ?? 'Poison',
    encounterType: overrides.encounterType ?? 'monster',
    enemyThreatLevel: overrides.enemyThreatLevel ?? 'medium',
    availableEnergy: overrides.availableEnergy ?? 3,
    maxEnergy: overrides.maxEnergy ?? 3,
    activeEffectNotes: overrides.activeEffectNotes ?? [],
  }
}

function makePathScore(): PathScore {
  return {
    node: { x: 1, y: 1, type: 'Elite' },
    score: 8.5,
    label: 'Elite first',
    reasons: ['High reward'],
    risk: 'medium',
  }
}

describe('advisor store combat state', () => {
  beforeEach(() => {
    useAdvisorStore.setState({
      cardRatings: null,
      combatAdvice: null,
      pathScores: null,
      relicRatings: null,
      eventAnalysis: null,
      shopEvaluations: null,
      restSiteAdvice: null,
      deckAnalysis: null,
      isCalculating: false,
      lastCalculatedAt: 0,
      selectedCombatLineIndex: 0,
      selectedBuildLensByClass: {},
      activeCombatKey: null,
    })
  })

  it('cycles combat lines and wraps back to the first line', () => {
    const store = useAdvisorStore.getState()
    store.setCombatAdvice(makeCombatAdvice())

    store.cycleCombatLine()
    expect(useAdvisorStore.getState().combatAdvice?.selectedLineIndex).toBe(1)

    useAdvisorStore.getState().cycleCombatLine()
    useAdvisorStore.getState().cycleCombatLine()
    expect(useAdvisorStore.getState().combatAdvice?.selectedLineIndex).toBe(0)
  })

  it('cycles build lenses for the active class and persists the selection', () => {
    const store = useAdvisorStore.getState()
    store.setCombatAdvice(makeCombatAdvice())

    store.cycleCombatBuild()

    expect(useAdvisorStore.getState().selectedBuildLensByClass.silent).toBe('poison')
    expect(useAdvisorStore.getState().combatAdvice?.selectedBuildLensId).toBe('poison')
  })

  it('resets the selected line on a new combat but keeps the chosen build lens', () => {
    const store = useAdvisorStore.getState()
    store.setCombatAdvice(makeCombatAdvice())
    store.cycleCombatLine()
    store.cycleCombatBuild()

    store.setCombatAdvice(makeCombatAdvice({
      combatKey: 'act1-floor2-round1',
      selectedBuildLensId: 'auto' as CombatBuildLensId,
      selectedBuildLensLabel: 'Auto',
    }))

    const nextState = useAdvisorStore.getState()
    expect(nextState.combatAdvice?.selectedLineIndex).toBe(0)
    expect(nextState.selectedBuildLensByClass.silent).toBe('poison')
    expect(nextState.combatAdvice?.selectedBuildLensId).toBe('poison')
  })

  it('clears stale map advice when combat advice becomes active', () => {
    const store = useAdvisorStore.getState()
    store.setPathScores([makePathScore()])

    expect(useAdvisorStore.getState().pathScores).toHaveLength(1)

    store.setCombatAdvice(makeCombatAdvice())

    const nextState = useAdvisorStore.getState()
    expect(nextState.combatAdvice).not.toBeNull()
    expect(nextState.pathScores).toBeNull()
  })
})
