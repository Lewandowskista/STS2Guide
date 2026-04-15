import { create } from 'zustand'
import type {
  AdvisorState,
  CardEvaluation,
  CombatAdvice,
  PathScore,
  RelicEvaluation,
  EventAnalysis,
  ShopItemEvaluation,
  DeckAnalysis,
  RestSiteAdvice,
  CombatBuildLensId,
  CombatBuildLensOption,
} from '@/types/advisor'

function findBuildLabel(options: CombatBuildLensOption[], buildId: CombatBuildLensId, fallback: string): string {
  return options.find(option => option.id === buildId)?.label ?? fallback
}

function clampLineIndex(advice: CombatAdvice, index: number): number {
  if (advice.candidateLines.length === 0) return 0
  return Math.max(0, Math.min(index, advice.candidateLines.length - 1))
}

function applyCombatSelection(
  advice: CombatAdvice,
  selectedLineIndex: number,
  selectedBuildLensId: CombatBuildLensId,
): CombatAdvice {
  const nextLineIndex = clampLineIndex(advice, selectedLineIndex)
  const selectedLine = advice.candidateLines[nextLineIndex] ?? advice.candidateLines[0]
  const selectedBuildLensLabel = findBuildLabel(
    advice.availableBuildLenses,
    selectedBuildLensId,
    selectedBuildLensId === 'auto' ? 'Auto' : advice.selectedBuildLensLabel,
  )

  return {
    ...advice,
    selectedLineIndex: nextLineIndex,
    selectedBuildLensId,
    selectedBuildLensLabel,
    suggestedPlay: selectedLine?.suggestedPlay ?? [],
    potionSuggestion: selectedLine?.potionSuggestion ?? advice.potionSuggestion,
    summary: selectedLine?.summary ?? advice.summary,
  }
}

const clearedContextualAdvice = {
  cardRatings: null,
  combatAdvice: null,
  pathScores: null,
  relicRatings: null,
  eventAnalysis: null,
  shopEvaluations: null,
  restSiteAdvice: null,
}

interface AdvisorStore extends AdvisorState {
  setCardRatings: (ratings: CardEvaluation[]) => void
  setCombatAdvice: (advice: CombatAdvice) => void
  setPathScores: (scores: PathScore[]) => void
  setRelicRatings: (ratings: RelicEvaluation[]) => void
  setEventAnalysis: (analysis: EventAnalysis) => void
  setShopEvaluations: (evals: ShopItemEvaluation[]) => void
  setRestSiteAdvice: (advice: RestSiteAdvice) => void
  setDeckAnalysis: (analysis: DeckAnalysis) => void
  setCalculating: (calculating: boolean) => void
  cycleCombatLine: () => void
  cycleCombatBuild: () => void
  clearContextualAdvice: () => void
}

export const useAdvisorStore = create<AdvisorStore>((set) => ({
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

  setCardRatings: (ratings) => set({
    ...clearedContextualAdvice,
    cardRatings: ratings,
    selectedCombatLineIndex: 0,
    activeCombatKey: null,
    lastCalculatedAt: Date.now(),
  }),
  setCombatAdvice: (advice) => set((state) => {
    const activeBuildLensId = state.selectedBuildLensByClass[advice.characterId] ?? advice.selectedBuildLensId ?? 'auto'
    const isNewCombat = state.activeCombatKey !== advice.combatKey
    const selectedCombatLineIndex = isNewCombat ? 0 : clampLineIndex(advice, state.selectedCombatLineIndex)
    const nextAdvice = applyCombatSelection(advice, selectedCombatLineIndex, activeBuildLensId)

    return {
      ...clearedContextualAdvice,
      combatAdvice: nextAdvice,
      selectedCombatLineIndex,
      activeCombatKey: advice.combatKey,
      lastCalculatedAt: Date.now(),
    }
  }),
  setPathScores: (scores) => set({
    ...clearedContextualAdvice,
    pathScores: scores,
    selectedCombatLineIndex: 0,
    activeCombatKey: null,
    lastCalculatedAt: Date.now(),
  }),
  setRelicRatings: (ratings) => set({
    ...clearedContextualAdvice,
    relicRatings: ratings,
    selectedCombatLineIndex: 0,
    activeCombatKey: null,
    lastCalculatedAt: Date.now(),
  }),
  setEventAnalysis: (analysis) => set({
    ...clearedContextualAdvice,
    eventAnalysis: analysis,
    selectedCombatLineIndex: 0,
    activeCombatKey: null,
    lastCalculatedAt: Date.now(),
  }),
  setShopEvaluations: (evals) => set({
    ...clearedContextualAdvice,
    shopEvaluations: evals,
    selectedCombatLineIndex: 0,
    activeCombatKey: null,
    lastCalculatedAt: Date.now(),
  }),
  setRestSiteAdvice: (advice) => set({
    ...clearedContextualAdvice,
    restSiteAdvice: advice,
    selectedCombatLineIndex: 0,
    activeCombatKey: null,
    lastCalculatedAt: Date.now(),
  }),
  setDeckAnalysis: (analysis) => set({ deckAnalysis: analysis }),
  setCalculating: (calculating) => set({ isCalculating: calculating }),
  cycleCombatLine: () => set((state) => {
    const advice = state.combatAdvice
    if (!advice || advice.candidateLines.length <= 1) return {}
    const selectedCombatLineIndex = (state.selectedCombatLineIndex + 1) % advice.candidateLines.length
    return {
      combatAdvice: applyCombatSelection(advice, selectedCombatLineIndex, advice.selectedBuildLensId),
      selectedCombatLineIndex,
      lastCalculatedAt: Date.now(),
    }
  }),
  cycleCombatBuild: () => set((state) => {
    const advice = state.combatAdvice
    if (!advice || advice.availableBuildLenses.length <= 1) return {}

    const currentBuildLensId = state.selectedBuildLensByClass[advice.characterId] ?? advice.selectedBuildLensId
    const currentIndex = advice.availableBuildLenses.findIndex(option => option.id === currentBuildLensId)
    const nextOption = advice.availableBuildLenses[(currentIndex + 1 + advice.availableBuildLenses.length) % advice.availableBuildLenses.length]
    const selectedBuildLensByClass = {
      ...state.selectedBuildLensByClass,
      [advice.characterId]: nextOption.id,
    }

    return {
      selectedBuildLensByClass,
      selectedCombatLineIndex: 0,
      combatAdvice: applyCombatSelection(advice, 0, nextOption.id),
      lastCalculatedAt: Date.now(),
    }
  }),
  clearContextualAdvice: () => set({
    ...clearedContextualAdvice,
    selectedCombatLineIndex: 0,
    activeCombatKey: null,
  }),
}))
