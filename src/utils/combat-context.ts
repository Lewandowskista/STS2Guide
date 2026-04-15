import type { GameState, StateType } from '@/types/game-state'
import { getActiveContext, isMidCombatStateType } from './context-resolution'

export function isMidCombatState(stateType: StateType): boolean {
  return isMidCombatStateType(stateType)
}

export function isCombatState(state: Pick<GameState, 'state_type' | 'battle'> | null | undefined): boolean {
  return getActiveContext(state as GameState | null | undefined) === 'combat' && !isMidCombatState(state?.state_type as StateType)
}

export function shouldShowCombatPanel(state: Pick<GameState, 'state_type' | 'battle'> | null | undefined): boolean {
  return getActiveContext(state as GameState | null | undefined) === 'combat'
}
