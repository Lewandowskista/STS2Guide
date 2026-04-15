import type { GameState, StateType } from '@/types/game-state'

export type ActiveContext =
  | 'combat'
  | 'card_reward'
  | 'map'
  | 'relic_select'
  | 'event'
  | 'shop'
  | 'rest_site'
  | null

const DIRECT_COMBAT_STATES = new Set<StateType>(['monster', 'elite', 'boss'])
const MID_COMBAT_STATES = new Set<StateType>(['hand_select', 'overlay', 'card_select'])
// States where the run is definitively over — wipe all advice immediately.
const HARD_CLEAR_STATES = new Set<StateType>(['death', 'victory'])
// Transient collection screens that follow combat or events. We don't assign them
// an active context (no panel is rendered for them) but we also do NOT clear advice —
// the last panel stays visible so the player has context while picking rewards.
const HOLD_STATES = new Set<StateType>(['rewards', 'treasure', 'crystal_sphere'])

function hasBattleData(state: Pick<GameState, 'battle'> | null | undefined): boolean {
  // Accept any battle object, even if enemies haven't populated yet on the first tick.
  // state_type check in getActiveContext covers the DIRECT_COMBAT_STATES case; this
  // fallback is for transitional unknown/menu states that still carry battle data.
  return Boolean(state?.battle)
}

function hasMapData(state: Pick<GameState, 'map'> | null | undefined): boolean {
  return Boolean(state?.map?.current_position || state?.map?.next_options?.length || state?.map?.nodes?.length)
}

function hasCardRewardData(state: Pick<GameState, 'card_reward' | 'cards_to_select'> | null | undefined): boolean {
  return Boolean(state?.card_reward?.cards?.length || state?.cards_to_select?.length)
}

function hasRelicSelectData(state: Pick<GameState, 'relic_select'> | null | undefined): boolean {
  return Boolean(state?.relic_select?.relics?.length)
}

function hasEventData(state: Pick<GameState, 'event'> | null | undefined): boolean {
  // Accept event object as soon as it appears — event_name or options may populate on next tick
  return Boolean(state?.event)
}

function hasShopData(state: Pick<GameState, 'shop'> | null | undefined): boolean {
  // Accept shop object even when items hasn't populated yet (null/undefined/empty array)
  return Boolean(state?.shop)
}

function hasRestSiteData(state: Pick<GameState, 'rest_site' | 'state_type'> | null | undefined): boolean {
  // The API often sends state_type:'rest_site' without a rest_site payload — treat the
  // state_type itself as sufficient evidence.
  return Boolean(state?.rest_site) || state?.state_type === 'rest_site'
}

export function isMidCombatStateType(stateType: StateType): boolean {
  return MID_COMBAT_STATES.has(stateType)
}

export function shouldKeepCombatAdvice(state: Pick<GameState, 'state_type' | 'battle'> | null | undefined): boolean {
  return Boolean(state && MID_COMBAT_STATES.has(state.state_type))
}

/** Returns true for transient reward/collection screens where advice should be
 *  held (not recalculated, not cleared) so the last panel stays visible. */
export function isHoldState(state: Pick<GameState, 'state_type'> | null | undefined): boolean {
  return Boolean(state && HOLD_STATES.has(state.state_type))
}

export function getActiveContext(state: GameState | null | undefined): ActiveContext {
  if (!state) return null

  // Run-ending states: wipe everything immediately
  if (HARD_CLEAR_STATES.has(state.state_type)) return null

  // Reward/collection screens: return null so no new panel is rendered,
  // but useAdvisor will detect isHoldState and skip clearing advice.
  if (HOLD_STATES.has(state.state_type)) return null

  if (DIRECT_COMBAT_STATES.has(state.state_type) || MID_COMBAT_STATES.has(state.state_type) || hasBattleData(state)) {
    return 'combat'
  }

  if (state.state_type === 'card_reward' || state.state_type === 'bundle_select' || hasCardRewardData(state)) {
    return 'card_reward'
  }

  if (state.state_type === 'map' || hasMapData(state)) {
    return 'map'
  }

  if (state.state_type === 'relic_select' || hasRelicSelectData(state)) {
    return 'relic_select'
  }

  if (state.state_type === 'event' || hasEventData(state)) {
    return 'event'
  }

  if (state.state_type === 'shop' || state.state_type === 'fake_merchant' || hasShopData(state)) {
    return 'shop'
  }

  if (state.state_type === 'rest_site' || hasRestSiteData(state)) {
    return 'rest_site'
  }

  return null
}
