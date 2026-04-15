import type { GameState, MapNode } from '@/types/game-state'

/**
 * Resolves the next navigable map nodes from the current game state.
 * Uses three fallback strategies:
 *   1. map.next_options (direct from API)
 *   2. Derived from current_position + nodes via children or leads_to arrays
 *   3. All nodes at the next row level
 */
export function resolveNextOptions(gameState: GameState): MapNode[] {
  const map = gameState.map
  if (!map) return []

  let nextOptions: MapNode[] = map.next_options ?? []

  if (nextOptions.length === 0 && map.nodes?.length && map.current_position) {
    const cur = map.current_position
    const curNode = map.nodes.find(n => n.col === cur.col && n.row === cur.row)
    if (curNode) {
      if (curNode.children?.length) {
        nextOptions = curNode.children
          .map(([col, row]) => map.nodes!.find(n => n.col === col && n.row === row) ?? null)
          .filter(Boolean) as MapNode[]
      }
      if (nextOptions.length === 0 && curNode.leads_to?.length) {
        nextOptions = curNode.leads_to
          .map(({ col, row }) => map.nodes!.find(n => n.col === col && n.row === row) ?? null)
          .filter(Boolean) as MapNode[]
      }
    }
  }

  if (nextOptions.length === 0 && map.nodes?.length) {
    const currentRow = map.current_position?.row ?? -1
    nextOptions = map.nodes.filter(n => n.row === currentRow + 1)
  }

  return nextOptions
}
