import { useEffect, useRef } from 'react'
import { useGameStore } from '@/stores/game-store'
import { useCodexStore } from '@/stores/codex-store'
import { useAdvisorStore } from '@/stores/advisor-store'
import { evaluateCards } from '@/engine/card-evaluator'
import { analyzeCombat } from '@/engine/combat-analyzer'
import { evaluatePaths } from '@/engine/path-evaluator'
import { evaluateRelics } from '@/engine/relic-evaluator'
import { analyzeEvent } from '@/engine/event-evaluator'
import { evaluateShop } from '@/engine/shop-evaluator'
import { analyzeDeck } from '@/engine/deck-analyzer'
import { detectArchetype } from '@/engine/archetype-detector'
import { evaluateRestSite } from '@/engine/rest-site-evaluator'
import { normalizeCharacterId } from '@/engine/combat-builds'
import { isBossImminent, estimateBossFloor } from '@/engine/boss-advisor'
import type { GameCard } from '@/types/game-state'
import { getActiveContext, shouldKeepCombatAdvice, isHoldState } from '@/utils/context-resolution'
import { resolveNextOptions } from '@/utils/map-utils'
import { resolveAdvisorCodex } from './advisor-codex'

export function useAdvisor() {
  const gameState = useGameStore(s => s.state)
  const codex = useCodexStore(s => s.data)
  // Use a ref for deckAnalysis to read latest value without triggering re-runs.
  // deckAnalysis is written by this same effect (setDeckAnalysis) — putting it
  // in the dependency array would cause an effect → state → effect cascade.
  const deckAnalysis = useAdvisorStore(s => s.deckAnalysis)
  const deckAnalysisRef = useRef(deckAnalysis)
  deckAnalysisRef.current = deckAnalysis

  const selectedBuildLensByClass = useAdvisorStore(s => s.selectedBuildLensByClass)
  const setCalculating = useAdvisorStore(s => s.setCalculating)
  const setDeckAnalysis = useAdvisorStore(s => s.setDeckAnalysis)
  const setCombatAdvice = useAdvisorStore(s => s.setCombatAdvice)
  const setCardRatings = useAdvisorStore(s => s.setCardRatings)
  const setPathScores = useAdvisorStore(s => s.setPathScores)
  const setRelicRatings = useAdvisorStore(s => s.setRelicRatings)
  const setEventAnalysis = useAdvisorStore(s => s.setEventAnalysis)
  const setShopEvaluations = useAdvisorStore(s => s.setShopEvaluations)
  const setRestSiteAdvice = useAdvisorStore(s => s.setRestSiteAdvice)
  const clearContextualAdvice = useAdvisorStore(s => s.clearContextualAdvice)

  useEffect(() => {
    if (!gameState) return

    const player = gameState.player
    if (!player) return

    const activeContext = getActiveContext(gameState)
    const effectiveCodex = resolveAdvisorCodex(codex, activeContext)
    if (!effectiveCodex) return

    const allDeckCards: GameCard[] = [
      ...(player.hand ?? []),
      ...(player.draw_pile ?? []),
      ...(player.discard_pile ?? []),
      ...(player.exhaust_pile ?? []),
    ].filter(Boolean)

    const act = gameState.run?.act ?? 1
    const floor = gameState.run?.floor ?? 1
    const character = player.character ?? ''
    const characterId = normalizeCharacterId(character)
    // Normalize arrays that may be absent from the API response
    const playerRelics = player.relics ?? []
    const playerStatus = player.status ?? []
    // B5: archetype detector expects persistent powers (Strength, Dexterity, etc.), not transient
    // in-combat status effects (Vulnerable, Weak). Pass player.powers for correct detection.
    const playerPowers = player.powers ?? []
    const archetype = detectArchetype(allDeckCards, effectiveCodex, playerRelics, playerPowers, characterId, floor)
    const selectedBuildLensId = selectedBuildLensByClass[characterId] ?? 'auto'

    setCalculating(true)

    try {
      if (allDeckCards.length > 0) {
        const nextDeckAnalysis = analyzeDeck(allDeckCards, playerRelics, effectiveCodex, playerStatus, character, act, floor, characterId, player.potions?.length ?? 0)
        setDeckAnalysis(nextDeckAnalysis)
      }

      // Determine upcoming threat for card evaluation
      const bossFloor = estimateBossFloor(act)
      const bossClose = isBossImminent(floor, bossFloor, 3)
      const upcomingThreat: 'elite' | 'boss' | 'none' = bossClose ? 'boss' : 'none'

      if (activeContext === 'combat' && !shouldKeepCombatAdvice(gameState)) {
        const advice = analyzeCombat(gameState, effectiveCodex, archetype, { selectedBuildLensId })
        if (advice) setCombatAdvice(advice)
        // If analyzeCombat returns null (no battle data yet), keep previous advice —
        // it will be replaced on the next poll when battle data arrives.
      } else if (shouldKeepCombatAdvice(gameState)) {
        // Keep last combat plan while a mid-combat overlay screen is open.
      } else if (activeContext === 'card_reward') {
        const cards = gameState.card_reward?.cards ?? gameState.cards_to_select ?? []
        const ratings = evaluateCards(cards, allDeckCards, playerRelics, effectiveCodex, archetype, playerStatus, act, floor, character, upcomingThreat, deckAnalysisRef.current?.buildTargets, player.stars)
        setCardRatings(ratings)
      } else if (activeContext === 'map') {
        const nextOptions = resolveNextOptions(gameState)
        if (nextOptions.length > 0) {
          const scores = evaluatePaths(nextOptions, player, act, floor, deckAnalysisRef.current, playerRelics)
          setPathScores(scores)
        }
        // If still no options found, leave previous pathScores — MapPanel handles empty gracefully
      } else if (activeContext === 'relic_select') {
        const relics = gameState.relic_select?.relics ?? []
        if (relics.length > 0) {
          const ratings = evaluateRelics(relics, allDeckCards, playerRelics, effectiveCodex, archetype, playerStatus, act)
          setRelicRatings(ratings)
        }
      } else if (activeContext === 'event') {
        const analysis = analyzeEvent(gameState, effectiveCodex, deckAnalysisRef.current, archetype)
        if (analysis) setEventAnalysis(analysis)
      } else if (activeContext === 'shop') {
        const nextOptions = resolveNextOptions(gameState)
        const shopItems = gameState.shop?.items ?? []
        const isFakeMerchant = gameState.state_type === 'fake_merchant'
        const evals = evaluateShop(shopItems, player, effectiveCodex, archetype, act, floor, isFakeMerchant, nextOptions, deckAnalysisRef.current?.buildTargets)
        setShopEvaluations(evals)
      } else if (activeContext === 'rest_site') {
        const nextOptions = resolveNextOptions(gameState)
        const advice = evaluateRestSite(gameState, effectiveCodex, deckAnalysisRef.current, nextOptions)
        if (advice) setRestSiteAdvice(advice)
      } else if (!isHoldState(gameState)) {
        // activeContext is null and not a hold state (death, victory, menu) — clear all advice
        clearContextualAdvice()
      }
      // isHoldState (rewards, treasure, crystal_sphere): do nothing — keep the last panel visible
    } catch (error) {
      console.error('Advisor error:', error)
    } finally {
      setCalculating(false)
    }
  }, [
    clearContextualAdvice,
    codex,
    gameState,
    selectedBuildLensByClass,
    setCalculating,
    setCardRatings,
    setCombatAdvice,
    setDeckAnalysis,
    setEventAnalysis,
    setPathScores,
    setRelicRatings,
    setRestSiteAdvice,
    setShopEvaluations,
  ])
}
