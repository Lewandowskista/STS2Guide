import type { ActivePower } from '@/types/game-state'

// Apply Vulnerable: incoming damage is increased by 50%
export function applyVulnerable(damage: number, powers: ActivePower[]): number {
  const vuln = powers.find(p => p.id === 'Vulnerable' || p.id === 'vulnerable')
  if (vuln && vuln.amount > 0) return Math.floor(damage * 1.5)
  return damage
}

// Apply Weak: outgoing damage is reduced by 25%
export function applyWeak(damage: number, powers: ActivePower[]): number {
  const weak = powers.find(p => p.id === 'Weak' || p.id === 'weak')
  if (weak && weak.amount > 0) return Math.floor(damage * 0.75)
  return damage
}

// Apply Strength to a damage value
export function applyStrength(damage: number, hitCount: number, powers: ActivePower[]): number {
  const str = powers.find(p => p.id === 'Strength' || p.id === 'strength')
  if (str && str.amount !== 0) return damage + (str.amount * hitCount)
  return damage
}

// Calculate total incoming damage from an enemy move
export function calcIncomingDamage(
  baseDamage: number,
  hitCount: number,
  enemyPowers: ActivePower[],
  playerPowers: ActivePower[],
): number {
  let dmg = baseDamage
  dmg = applyStrength(dmg, 1, enemyPowers) // per-hit strength
  dmg = applyWeak(dmg, enemyPowers)         // enemy Weak
  dmg = applyVulnerable(dmg, playerPowers)  // player Vulnerable
  dmg = Math.max(0, dmg)
  return dmg * hitCount
}

// How much block can the player generate from their current hand?
export function estimateMaxBlock(
  hand: Array<{ id: string; name: string; type: string }>,
  codexCards: Map<string, { block: number | null; cost: number }>,
  energy: number,
): number {
  let totalBlock = 0
  let energyLeft = energy
  const blockCards = hand
    .filter(c => c.type === 'Skill' || c.type === 'Attack')
    .map(c => {
      const cx = codexCards.get(c.id)
      return { cost: cx?.cost ?? 1, block: cx?.block ?? 0 }
    })
    .filter(c => c.block > 0)
    .sort((a, b) => (b.block / Math.max(1, b.cost)) - (a.block / Math.max(1, a.cost)))

  for (const card of blockCards) {
    if (energyLeft >= card.cost) {
      totalBlock += card.block
      energyLeft -= card.cost
    }
  }
  return totalBlock
}
