import type { SynergyRule, SynergyContext } from '@/types/synergy'

const hasKeyword = (ctx: SynergyContext, kw: string) =>
  ctx.card.keywords?.some(k => k.toLowerCase().includes(kw.toLowerCase())) ?? false

const deckHasKeyword = (ctx: SynergyContext, kw: string) =>
  ctx.codexDeck.some(c => c.keywords?.some(k => k.toLowerCase().includes(kw.toLowerCase())))

const deckHasPowerApplied = (ctx: SynergyContext, powerId: string) =>
  ctx.codexDeck.some(c =>
    c.powers_applied?.some(p => p.power.toLowerCase().includes(powerId.toLowerCase()))
  )

const relicHas = (ctx: SynergyContext, relicId: string) =>
  ctx.relics.some(r => r.id.toLowerCase().includes(relicId.toLowerCase()))

const deckCardCount = (ctx: SynergyContext) => ctx.deck.length
const deckPowerCount = (ctx: SynergyContext) =>
  ctx.codexDeck.filter(c => c.type === 'Power').length
const deckAttackCount = (ctx: SynergyContext) =>
  ctx.codexDeck.filter(c => c.type === 'Attack').length

export const SYNERGY_RULES: SynergyRule[] = [
  // --- STRENGTH SCALING ---
  {
    id: 'strength-multi-hit',
    name: 'Strength + Multi-Hit',
    edgeType: 'power-scaling',
    baseWeight: 0.9,
    check: (ctx) => {
      const isMultiHit = (ctx.card.hit_count ?? 1) > 1 && ctx.card.type === 'Attack'
      return isMultiHit && deckHasPowerApplied(ctx, 'Strength')
    },
    score: (ctx) => {
      const hitCount = ctx.card.hit_count ?? 1
      return Math.min(1.0, 0.4 + (hitCount - 2) * 0.15)
    },
    describe: (ctx) => `${ctx.card.name} hits ${ctx.card.hit_count}x — multiplies Strength gain`,
  },
  {
    id: 'card-applies-strength',
    name: 'Strength Source',
    edgeType: 'power-scaling',
    baseWeight: 0.85,
    check: (ctx) => {
      const appliesStrength = ctx.card.powers_applied?.some(p => p.power.toLowerCase().includes('strength')) ?? false
      return appliesStrength && deckAttackCount(ctx) > 3
    },
    score: (ctx) => {
      const strengthAmount = ctx.card.powers_applied?.find(p => p.power.toLowerCase().includes('strength'))?.amount ?? 0
      return Math.min(1.0, 0.5 + strengthAmount * 0.1)
    },
    describe: () => 'Applies Strength — scales all attack cards',
  },

  // --- DRAW ENGINE ---
  {
    id: 'draw-with-cheap-deck',
    name: 'Draw Engine',
    edgeType: 'draw-engine',
    baseWeight: 0.8,
    check: (ctx) => {
      const isDraw = (ctx.card.cards_draw ?? 0) > 0
      const deckHasCheapCards = ctx.codexDeck.filter(c => (c.cost ?? 1) <= 1).length >= 3
      return isDraw && deckHasCheapCards
    },
    score: (ctx) => {
      const drawAmount = ctx.card.cards_draw ?? 0
      const cheapCount = ctx.codexDeck.filter(c => (c.cost ?? 1) <= 1).length
      return Math.min(1.0, 0.3 + drawAmount * 0.15 + cheapCount * 0.05)
    },
    describe: (ctx) => `Draws ${ctx.card.cards_draw} cards — fuels cheap deck`,
  },

  // --- EXHAUST SYNERGY ---
  {
    id: 'exhaust-trigger',
    name: 'Exhaust Synergy',
    edgeType: 'exhaust-synergy',
    baseWeight: 0.75,
    check: (ctx) => {
      const cardExhausts = hasKeyword(ctx, 'exhaust')
      const deckHasExhaustPayoff = relicHas(ctx, 'Charon') || deckHasPowerApplied(ctx, 'Feel No Pain')
        || ctx.codexDeck.some(c => c.description?.toLowerCase().includes('whenever you exhaust'))
      return cardExhausts && deckHasExhaustPayoff
    },
    score: (ctx) => {
      // More exhaust payoff cards = more triggers = higher value
      const payoffCount = ctx.codexDeck.filter(c =>
        c.description?.toLowerCase().includes('whenever you exhaust') ||
        c.description?.toLowerCase().includes('on exhaust')
      ).length + (relicHas(ctx, 'Charon') ? 1 : 0) + (relicHas(ctx, 'Rupture') ? 1 : 0)
      return Math.min(1.0, 0.45 + payoffCount * 0.1)
    },
    describe: () => 'Exhaust triggers on-exhaust effects',
  },
  {
    id: 'exhaust-payoff',
    name: 'On-Exhaust Payoff',
    edgeType: 'exhaust-synergy',
    baseWeight: 0.75,
    check: (ctx) => {
      const isPayoff = ctx.card.description?.toLowerCase().includes('whenever you exhaust')
        || ctx.card.description?.toLowerCase().includes('on exhaust')
      const deckExhausts = deckHasKeyword(ctx, 'exhaust')
      return isPayoff && deckExhausts
    },
    score: (ctx) => {
      const exhaustCount = ctx.codexDeck.filter(c => c.keywords?.some(k => k === 'Exhaust')).length
      return Math.min(1.0, 0.4 + exhaustCount * 0.1)
    },
    describe: (ctx) => {
      const count = ctx.codexDeck.filter(c => c.keywords?.some(k => k === 'Exhaust')).length
      return `${count} Exhaust cards in deck to trigger this`
    },
  },

  // --- BLOCK SCALING ---
  {
    id: 'dexterity-block-scaling',
    name: 'Dexterity Scaling',
    edgeType: 'block-scaling',
    baseWeight: 0.8,
    check: (ctx) => {
      const isBlock = (ctx.card.block ?? 0) > 0
      return isBlock && deckHasPowerApplied(ctx, 'Dexterity')
    },
    score: (ctx) => {
      const dexSource = ctx.codexDeck.find(c =>
        c.powers_applied?.some(p => p.power.toLowerCase().includes('dexterity'))
      )
      const dexAmount = dexSource?.powers_applied?.find(p => p.power.toLowerCase().includes('dexterity'))?.amount ?? 1
      return Math.min(1.0, 0.4 + dexAmount * 0.1)
    },
    describe: () => 'Block card — scales with Dexterity',
  },

  // --- ORB SYNERGY ---
  {
    id: 'orb-generator',
    name: 'Orb Synergy',
    edgeType: 'orb-synergy',
    baseWeight: 0.7,
    check: (ctx) => {
      const generatesOrb = hasKeyword(ctx, 'channel') || ctx.card.description?.toLowerCase().includes('channel')
      const hasOrbPayoff = ctx.codexDeck.some(c =>
        c.keywords?.some(k => k.toLowerCase().includes('evoke')) ||
        c.description?.toLowerCase().includes('evoke')
      )
      return generatesOrb && hasOrbPayoff
    },
    score: (ctx) => {
      // More evoke cards = more value from each channel
      const evokeCount = ctx.codexDeck.filter(c =>
        c.keywords?.some(k => k.toLowerCase().includes('evoke')) ||
        c.description?.toLowerCase().includes('evoke')
      ).length
      return Math.min(1.0, 0.4 + evokeCount * 0.1)
    },
    describe: () => 'Channels orbs for Evoke payoffs',
  },

  // --- ENERGY SYNERGY ---
  {
    id: 'energy-hungry-deck',
    name: 'Energy + Expensive Cards',
    edgeType: 'energy-synergy',
    baseWeight: 0.75,
    check: (ctx) => {
      const givesEnergy = (ctx.card.energy_gain ?? 0) > 0
      const hasExpensiveCards = ctx.codexDeck.filter(c => (c.cost ?? 0) >= 2).length >= 3
      return givesEnergy && hasExpensiveCards
    },
    score: (ctx) => {
      const expCount = ctx.codexDeck.filter(c => (c.cost ?? 0) >= 2).length
      return Math.min(1.0, 0.4 + expCount * 0.05)
    },
    describe: () => 'Generates energy for expensive cards',
  },

  // --- KEYWORD MATCH ---
  {
    id: 'innate-synergy',
    name: 'Innate Synergy',
    edgeType: 'keyword-match',
    baseWeight: 0.6,
    check: (ctx) => hasKeyword(ctx, 'innate'),
    score: () => 0.5,
    describe: () => 'Innate — always in opening hand',
  },
  {
    id: 'ethereal-no-retain',
    name: 'Ethereal Risk',
    edgeType: 'keyword-match',
    baseWeight: 0.5,
    check: (ctx) => hasKeyword(ctx, 'ethereal'),
    score: () => -0.2,
    describe: () => 'Ethereal — exhausted if not played this turn',
  },

  // --- MULTI-HIT ---
  {
    id: 'shiv-multi-hit',
    name: 'Multi-Hit Attack',
    edgeType: 'multi-hit',
    baseWeight: 0.7,
    check: (ctx) => (ctx.card.hit_count ?? 1) >= 3 && ctx.card.type === 'Attack',
    score: (ctx) => {
      const hits = ctx.card.hit_count ?? 1
      return Math.min(1.0, 0.35 + hits * 0.08)
    },
    describe: (ctx) => `${ctx.card.hit_count} hits — strong with damage modifiers`,
  },

  // --- POWER HEAVY ---
  {
    id: 'power-density',
    name: 'Power Density',
    edgeType: 'power-combo',
    baseWeight: 0.65,
    check: (ctx) => ctx.card.type === 'Power' && deckPowerCount(ctx) >= 3,
    score: (ctx) => {
      const pCount = deckPowerCount(ctx)
      return Math.min(0.8, 0.3 + pCount * 0.08)
    },
    describe: (ctx) => {
      const count = deckPowerCount(ctx)
      return `${count} powers in deck — builds a strong board state`
    },
  },

  // --- DECK SIZE PENALTY ---
  {
    id: 'large-deck-penalty',
    name: 'Deck Bloat',
    edgeType: 'keyword-match',
    baseWeight: 0.5,
    check: (ctx) => deckCardCount(ctx) >= 20 && ctx.card.rarity === 'Common',
    score: (ctx) => {
      // Penalty grows with deck size: bigger decks suffer more from each extra card
      const extra = Math.max(0, deckCardCount(ctx) - 20)
      return Math.max(-0.7, -0.2 - extra * 0.02)
    },
    describe: () => 'Deck already large — commons add inconsistency',
  },

  // --- STATUS INFLICTION ---
  {
    id: 'poison-stacking',
    name: 'Poison Stack',
    edgeType: 'status-inflict',
    baseWeight: 0.8,
    check: (ctx) => {
      const appliesPoison = ctx.card.powers_applied?.some(p => p.power.toLowerCase().includes('poison')) ?? false
      const hasOtherPoison = deckHasPowerApplied(ctx, 'Poison')
      return appliesPoison && hasOtherPoison
    },
    score: (ctx) => {
      const poisonAmount = ctx.card.powers_applied?.find(p => p.power.toLowerCase().includes('poison'))?.amount ?? 0
      return Math.min(1.0, 0.4 + poisonAmount * 0.05)
    },
    describe: (ctx) => {
      const amt = ctx.card.powers_applied?.find(p => p.power.toLowerCase().includes('poison'))?.amount ?? 0
      return `Applies ${amt} Poison — stacks with existing poison`
    },
  },

  // --- POISON BUILD COMBOS ---
  {
    id: 'catalyst-synergy',
    name: 'Catalyst Combo',
    edgeType: 'combo',
    baseWeight: 0.9,
    check: (ctx) => {
      const isCatalyst = ctx.card.name?.toLowerCase().includes('catalyst')
      const hasPoison = deckHasPowerApplied(ctx, 'Poison')
      return isCatalyst && hasPoison
    },
    score: (ctx) => {
      const poisonCount = ctx.codexDeck.filter(c => c.powers_applied?.some(p => p.power.toLowerCase().includes('poison'))).length
      return Math.min(1.0, 0.6 + poisonCount * 0.1)
    },
    describe: (ctx) => {
      const count = ctx.codexDeck.filter(c => c.powers_applied?.some(p => p.power.toLowerCase().includes('poison'))).length
      return `Catalyst doubles poison — ${count} poison sources in deck`
    },
  },

  // --- SHIV BUILD COMBOS ---
  {
    id: 'shiv-accuracy-combo',
    name: 'Accuracy Combo',
    edgeType: 'combo',
    baseWeight: 0.9,
    check: (ctx) => {
      const isShiv = ctx.card.name?.toLowerCase().includes('shiv')
      const hasAccuracy = ctx.codexDeck.some(c => c.name?.toLowerCase().includes('accuracy'))
      return isShiv && hasAccuracy
    },
    score: (ctx) => {
      // Each Accuracy adds +4/+6 damage per Shiv — more Accuracies = more value per Shiv
      const accuracyCount = ctx.codexDeck.filter(c => c.name?.toLowerCase().includes('accuracy')).length
      return Math.min(1.0, 0.6 + accuracyCount * 0.15)
    },
    describe: (ctx) => {
      const count = ctx.codexDeck.filter(c => c.name?.toLowerCase().includes('accuracy')).length
      return `Shiv + ${count}× Accuracy — each Accuracy buffs Shiv by 4 damage`
    },
  },
  {
    id: 'thousand-cuts-shiv',
    name: 'Thousand Cuts',
    edgeType: 'combo',
    baseWeight: 0.85,
    check: (ctx) => {
      const isAttack = ctx.card.type === 'Attack'
      const hasThouCuts = ctx.codexDeck.some(c => c.name?.toLowerCase().includes('thousand cuts'))
      return isAttack && hasThouCuts
    },
    score: (ctx) => {
      const attackCount = deckAttackCount(ctx)
      return Math.min(0.9, 0.4 + attackCount * 0.03)
    },
    describe: (ctx) => `${deckAttackCount(ctx)} attacks with Thousand Cuts — every attack triggers it`,
  },

  // --- ORB CHAINING ---
  {
    id: 'orb-channel-evoke-chain',
    name: 'Channel → Evoke Chain',
    edgeType: 'combo',
    baseWeight: 0.85,
    check: (ctx) => {
      const isEvoke = ctx.card.keywords?.some(k => k.toLowerCase().includes('evoke')) || ctx.card.description?.toLowerCase().includes('evoke')
      const hasChannelers = ctx.codexDeck.some(c => c.keywords?.some(k => k.toLowerCase().includes('channel')))
      return isEvoke && hasChannelers
    },
    score: (ctx) => {
      const channelCount = ctx.codexDeck.filter(c => c.keywords?.some(k => k.toLowerCase().includes('channel'))).length
      return Math.min(1.0, 0.5 + channelCount * 0.1)
    },
    describe: (ctx) => {
      const count = ctx.codexDeck.filter(c => c.keywords?.some(k => k.toLowerCase().includes('channel'))).length
      return `Evoke synergy — ${count} channel sources to fill orb slots`
    },
  },

  // --- DISCARD SYNERGIES ---
  {
    id: 'discard-payoff',
    name: 'Discard Payoff',
    edgeType: 'combo',
    baseWeight: 0.85,
    check: (ctx) => {
      const cardTriggersDiscard = ctx.card.keywords?.some(k => k.toLowerCase().includes('discard'))
        || ctx.card.description?.toLowerCase().includes('when you discard')
        || ctx.card.description?.toLowerCase().includes('whenever you discard')
      const deckDiscards = ctx.codexDeck.some(c =>
        c.keywords?.some(k => k.toLowerCase().includes('discard')) ||
        c.description?.toLowerCase().includes('discard')
      )
      return cardTriggersDiscard && deckDiscards
    },
    score: (ctx) => {
      const discardCount = ctx.codexDeck.filter(c =>
        c.keywords?.some(k => k.toLowerCase().includes('discard'))
      ).length
      return Math.min(1.0, 0.5 + discardCount * 0.1)
    },
    describe: (ctx) => {
      const count = ctx.codexDeck.filter(c => c.keywords?.some(k => k.toLowerCase().includes('discard'))).length
      return `Discard payoff — ${count} discard cards in deck to trigger it`
    },
  },

  // --- COMBO: VULNERABLE + HEAVY ATTACK ---
  {
    id: 'vulnerable-heavy-hitter',
    name: 'Vulnerable + Heavy Hit',
    edgeType: 'combo',
    baseWeight: 0.8,
    check: (ctx) => {
      const appliesVuln = ctx.card.powers_applied?.some(p => p.power.toLowerCase().includes('vulnerable')) ?? false
      const hasHighDmgAttacks = ctx.codexDeck.some(c => c.type === 'Attack' && (c.damage ?? 0) >= 12)
      return appliesVuln && hasHighDmgAttacks
    },
    score: (ctx) => {
      const heavyCount = ctx.codexDeck.filter(c => c.type === 'Attack' && (c.damage ?? 0) >= 12).length
      return Math.min(1.0, 0.5 + heavyCount * 0.1)
    },
    describe: (ctx) => {
      const count = ctx.codexDeck.filter(c => c.type === 'Attack' && (c.damage ?? 0) >= 12).length
      return `Applies Vulnerable — amplifies ${count} heavy attacks by 50%`
    },
  },

  // --- BLOCK + BODY SLAM ---
  {
    id: 'block-body-slam',
    name: 'Block → Damage',
    edgeType: 'combo',
    baseWeight: 0.85,
    check: (ctx) => {
      const isBodySlam = ctx.card.name?.toLowerCase().includes('body slam')
      const hasBlockCards = ctx.codexDeck.filter(c => (c.block ?? 0) > 0).length >= 4
      return isBodySlam && hasBlockCards
    },
    score: (ctx) => {
      const blockCards = ctx.codexDeck.filter(c => (c.block ?? 0) > 0).length
      return Math.min(1.0, 0.5 + blockCards * 0.08)
    },
    describe: (ctx) => {
      const count = ctx.codexDeck.filter(c => (c.block ?? 0) > 0).length
      return `Body Slam deals damage equal to block — ${count} block sources in deck`
    },
  },

  // --- ARCHETYPE CONVERGENCE BONUS ---
  {
    id: 'archetype-convergence',
    name: 'Build Convergence',
    edgeType: 'archetype-fit',
    baseWeight: 0.7,
    check: (ctx) => {
      if (!ctx.archetype || ctx.archetype.primary === 'balanced') return false
      // Card has same archetype keyword as primary archetype
      const archKeywords: Record<string, string[]> = {
        'strength-scaling': ['strength'],
        'poison': ['poison'],
        'exhaust': ['exhaust'],
        'orb-focus': ['channel', 'evoke', 'orb'],
        'shiv': ['shiv'],
        'discard': ['discard'],
        'block-turtle': ['barricade', 'entrench'],
        'draw-engine': ['draw'],
      }
      const kws = archKeywords[ctx.archetype.primary] ?? []
      return ctx.archetype.confidence >= 0.5 && kws.some(k =>
        ctx.card.keywords?.some(ck => ck.toLowerCase().includes(k)) ||
        ctx.card.description?.toLowerCase().includes(k)
      )
    },
    score: (ctx) => ctx.archetype.confidence * 0.5,
    describe: (ctx) => `Reinforces your ${ctx.archetype.label} build (confidence: ${Math.round(ctx.archetype.confidence * 100)}%)`,
  },

  // --- AoE COVERAGE ---
  {
    id: 'aoe-coverage',
    name: 'AoE Coverage',
    edgeType: 'combo-setup',
    baseWeight: 0.75,
    check: (ctx) => {
      const isAoe = ctx.card.target_type === 'AllEnemy' ||
        ctx.card.description?.toLowerCase().includes('all enemies') ||
        (ctx.card.hit_count ?? 1) > 2
      const lackingAoe = !ctx.codexDeck.some(c =>
        c.target_type === 'AllEnemy' ||
        c.description?.toLowerCase().includes('all enemies') ||
        (c.hit_count ?? 1) > 2
      )
      return isAoe && lackingAoe
    },
    score: () => 0.75,
    describe: (ctx) => `${ctx.card.name} adds AoE — deck was missing multi-target coverage`,
  },

  // --- POISON SCALING (Catalyst payoff) ---
  {
    id: 'poison-catalyst',
    name: 'Poison Doubler',
    edgeType: 'power-scaling',
    baseWeight: 0.85,
    check: (ctx) => {
      const isCatalyst = ctx.card.name?.toLowerCase().includes('catalyst') ||
        ctx.card.description?.toLowerCase().includes('double') && ctx.card.description?.toLowerCase().includes('poison')
      const hasPoisonSource = ctx.codexDeck.some(c =>
        c.keywords?.some(k => k.toLowerCase().includes('poison'))
      )
      return isCatalyst && hasPoisonSource
    },
    score: () => 0.85,
    describe: () => 'Catalyst doubles Poison — exponential scaling with existing stack',
  },

  // --- BOSS DEBUFF RESISTANCE (Artifact) ---
  {
    id: 'artifact-debuff-shield',
    name: 'Artifact Shield',
    edgeType: 'power-scaling',
    baseWeight: 0.7,
    check: (ctx) => {
      const grantsArtifact =
        ctx.card.description?.toLowerCase().includes('artifact') &&
        (ctx.card.type === 'Power' || ctx.card.type === 'Skill')
      return grantsArtifact
    },
    score: () => 0.7,
    describe: () => 'Artifact blocks the next debuff — excellent vs bosses and debuffing elites',
  },

  // --- ELITE BURST (front-loaded single-target damage) ---
  {
    id: 'elite-burst',
    name: 'Elite Burst',
    edgeType: 'combo-payoff',
    baseWeight: 0.7,
    check: (ctx) => {
      const isHighDamageAttack = ctx.card.type === 'Attack' && (ctx.card.damage ?? 0) >= 14
      const hasBurstSetup = ctx.codexDeck.some(c =>
        c.powers_applied?.some(p => p.power.toLowerCase().includes('strength')) ||
        c.keywords?.some(k => k.toLowerCase().includes('vulnerable'))
      )
      return isHighDamageAttack && hasBurstSetup
    },
    score: (ctx) => {
      const dmg = ctx.card.damage ?? 14
      return Math.min(0.9, 0.5 + (dmg - 14) * 0.02)
    },
    describe: (ctx) => `${ctx.card.name} (${ctx.card.damage} dmg) — strong burst for elite fights`,
  },

  // --- STATUS CARD SYNERGY (Wound/Burn builds) ---
  {
    id: 'status-synergy',
    name: 'Status Synergy',
    edgeType: 'combo-setup',
    baseWeight: 0.65,
    check: (ctx) => {
      const addsStatus = ctx.card.description?.toLowerCase().includes('wound') ||
        ctx.card.description?.toLowerCase().includes('burn') ||
        ctx.card.description?.toLowerCase().includes('dazed')
      const hasStatusPayoff = ctx.codexDeck.some(c =>
        c.description?.toLowerCase().includes('status') ||
        c.name?.toLowerCase().includes('burning')
      ) || relicHas(ctx, 'burning_blood') || relicHas(ctx, 'fire_breathing')
      return addsStatus && hasStatusPayoff
    },
    score: (ctx) => {
      // More payoff cards = more triggers per status card generated
      const payoffCount = ctx.codexDeck.filter(c =>
        c.description?.toLowerCase().includes('status') || c.name?.toLowerCase().includes('burning')
      ).length + (relicHas(ctx, 'fire_breathing') ? 1 : 0)
      return Math.min(0.9, 0.4 + payoffCount * 0.1)
    },
    describe: (ctx) => `${ctx.card.name} generates Status cards — synergizes with your payoff cards`,
  },

  // --- VULNERABLE + POISON AMPLIFY ---
  {
    id: 'vulnerable-poison-amplify',
    name: 'Vulnerable + Poison',
    edgeType: 'combo',
    baseWeight: 0.8,
    check: (ctx) => {
      const appliesVuln = ctx.card.powers_applied?.some(p => p.power.toLowerCase().includes('vulnerable')) ?? false
      const hasPoisonSource = deckHasPowerApplied(ctx, 'Poison')
      return appliesVuln && hasPoisonSource
    },
    score: (ctx) => {
      const poisonCount = ctx.codexDeck.filter(c =>
        c.powers_applied?.some(p => p.power.toLowerCase().includes('poison'))
      ).length
      return Math.min(0.9, 0.4 + poisonCount * 0.1)
    },
    describe: (ctx) => {
      const count = ctx.codexDeck.filter(c =>
        c.powers_applied?.some(p => p.power.toLowerCase().includes('poison'))
      ).length
      return `Vulnerable amplifies poison damage — ${count} poison sources benefit`
    },
  },

  // --- WEAK DEBUFF PAYOFF ---
  {
    id: 'weak-debuff-payoff',
    name: 'Weak + Heavy Attacks',
    edgeType: 'combo',
    baseWeight: 0.7,
    check: (ctx) => {
      const appliesWeak = (ctx.card.powers_applied?.some(p => p.power.toLowerCase().includes('weak')) ?? false)
        || (ctx.card.description?.toLowerCase().includes('apply') && ctx.card.description?.toLowerCase().includes('weak') || false)
      const hasHeavyAttacks = ctx.codexDeck.some(c => c.type === 'Attack' && (c.damage ?? 0) >= 10)
      return appliesWeak && hasHeavyAttacks
    },
    score: (ctx) => {
      const heavyCount = ctx.codexDeck.filter(c => c.type === 'Attack' && (c.damage ?? 0) >= 10).length
      return Math.min(0.85, 0.35 + heavyCount * 0.08)
    },
    describe: (ctx) => {
      const count = ctx.codexDeck.filter(c => c.type === 'Attack' && (c.damage ?? 0) >= 10).length
      return `Applies Weak (enemy deals 25% less) — protects ${count} heavy attack turns`
    },
  },

  // --- WOUND / BURN STACKING ---
  {
    id: 'wound-burn-stacking',
    name: 'Wound / Burn Stacking',
    edgeType: 'status-inflict',
    baseWeight: 0.7,
    check: (ctx) => {
      const inflictsWoundOrBurn =
        (ctx.card.description?.toLowerCase().includes('wound') && ctx.card.description?.toLowerCase().includes('add')) ||
        (ctx.card.description?.toLowerCase().includes('burn') && ctx.card.description?.toLowerCase().includes('add'))
      // Need another card or relic that cares about status count
      const hasStatusPayoff = ctx.codexDeck.some(c =>
        c.description?.toLowerCase().includes('wound') ||
        c.description?.toLowerCase().includes('burn') ||
        c.description?.toLowerCase().includes('status')
      ) || relicHas(ctx, 'fire_breathing') || relicHas(ctx, 'tingsha')
      return inflictsWoundOrBurn && hasStatusPayoff
    },
    score: (ctx) => {
      const statusInflictors = ctx.codexDeck.filter(c =>
        (c.description?.toLowerCase().includes('wound') && c.description?.toLowerCase().includes('add')) ||
        (c.description?.toLowerCase().includes('burn') && c.description?.toLowerCase().includes('add'))
      ).length
      return Math.min(0.85, 0.35 + statusInflictors * 0.1)
    },
    describe: (ctx) => `${ctx.card.name} inflicts Wounds/Burns — stacks with existing status-count payoffs`,
  },
]
