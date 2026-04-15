/**
 * Shared constants for the advisory engine.
 * Centralising thresholds here makes them easy to tune and documents
 * the reasoning behind each value.
 */

// ─── Deck size thresholds ────────────────────────────────────────────────────

/**
 * Below this deck size the archetype detector returns 'undecided' because
 * there aren't enough cards to form a reliable signal.
 */
export const ARCHETYPE_MIN_DECK_SIZE = 5

/**
 * Per-character versions of ARCHETYPE_MIN_DECK_SIZE.
 * Silent starts with a smaller pool; Defect's starter deck is larger.
 */
export const ARCHETYPE_MIN_DECK_SIZE_BY_CHARACTER: Record<string, number> = {
  ironclad: 5,
  silent: 4,
  defect: 6,
  regent: 5,
  necrobinder: 5,
}

/**
 * Deck size above which the "card draw missing" weakness is flagged.
 * Small decks cycle quickly anyway; draw cards only matter once the deck grows.
 */
export const DECK_NO_DRAW_THRESHOLD = 12

/**
 * Deck size above which "deck too large" weakness is flagged.
 * Varies by character — Defect benefits from a larger pool of orb generators.
 */
export const DECK_TOO_LARGE_THRESHOLD = 30

/** Per-character deck-too-large thresholds. */
export const DECK_TOO_LARGE_BY_CHARACTER: Record<string, number> = {
  ironclad: 28,
  silent: 22,
  defect: 35,
  regent: 28,
  necrobinder: 28,
}

/**
 * Deck size above which adding another card incurs a consistency penalty.
 * Used in card evaluation.
 */
export const CARD_DECK_SIZE_PENALTY_THRESHOLD = 25

// ─── Card cost thresholds ────────────────────────────────────────────────────

/**
 * Average card cost above which a deck is flagged as "slow early" when the
 * deck is small (< 20 cards).  Decks that cost more than 1 energy on average
 * will struggle to play multiple cards on early turns.
 */
export const HIGH_AVG_COST_THRESHOLD = 1.5

// ─── Floor / act constants ───────────────────────────────────────────────────

/**
 * Number of floors per act in a standard STS2 run.
 * Used to estimate boss floors and proximity.
 */
export const FLOORS_PER_ACT = 17

/**
 * How many floors from the act boss the player is considered "near boss".
 * At this distance rest-site heal and boss-preparation logic kick in.
 */
export const NEAR_BOSS_LOOKAHEAD = 3
