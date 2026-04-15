import { describe, expect, it } from 'vitest'
import { buildEmptyCodexData, resolveAdvisorCodex } from './advisor-codex'

describe('advisor codex fallback', () => {
  it('provides an empty codex for combat when live codex data is not loaded yet', () => {
    const codex = resolveAdvisorCodex(null, 'combat')

    expect(codex).not.toBeNull()
    expect(codex?.cards).toEqual([])
    expect(codex?.cardById.size).toBe(0)
  })

  it('provides an empty codex for non-combat contexts so panels can render while codex loads', () => {
    expect(resolveAdvisorCodex(null, 'map')).not.toBeNull()
    // null context (rewards, death, menu) still returns empty codex — useAdvisor guards via clearContextualAdvice
    expect(resolveAdvisorCodex(null, null)).not.toBeNull()
  })

  it('reuses loaded codex data when available', () => {
    const codex = buildEmptyCodexData()
    expect(resolveAdvisorCodex(codex, 'combat')).toBe(codex)
  })
})
