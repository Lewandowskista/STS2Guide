# STS2 Advisor

A real-time advisory overlay for **Slay the Spire 2**. Runs as a transparent fullscreen desktop overlay and provides intelligent, context-aware recommendations across every phase of your run — combat, card rewards, map pathing, relics, events, shops, and rest sites.

---

## What It Does

STS2 Advisor connects to the game via a local mod API and analyzes your current game state to surface actionable advice:

- **Combat** — Multi-line play planning, damage calculations, lethal detection, threat assessment, boss/elite intelligence
- **Card Rewards** — Letter-grade ratings (S–F) with synergy explanations and build-fit analysis
- **Map Pathing** — Node scoring with risk/reward and boss-prep tracking
- **Relic Selection** — Synergy-based ratings and explanations
- **Events** — Option-by-option analysis with outcome predictions
- **Shop** — Item ratings, removal suggestions, gold affordability assessment
- **Rest Site** — Action recommendations (rest vs. smith vs. lift vs. toke vs. dig vs. recall)
- **Deck Analysis** — Persistent panel showing archetype, power level, weaknesses, win conditions, and active build targets

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 |
| Build Tool | Vite 8 |
| Desktop Shell | Electron 41 |
| Language | TypeScript 6 |
| Styling | Tailwind CSS 4 |
| State Management | Zustand 5 |
| Animation | Framer Motion 12 |
| Icons | Lucide React |
| Testing | Vitest + @testing-library/react |
| Packaging | Electron Builder (NSIS + portable) |

---

## Prerequisites

- **Node.js** 18+
- **Slay the Spire 2** with the **STS2MCP mod** installed
  - The mod exposes a local API at `http://localhost:15526` that the advisor polls

---

## Installation & Running

### Development

```bash
npm install
npm run dev:electron
```

This starts the Vite dev server and launches Electron with hot reload. DevTools are open by default in dev mode.

### Production Build

```bash
npm run build:electron
```

Outputs to `release/`:
- `STS2 Advisor Setup.exe` — NSIS installer (full install with desktop shortcut)
- `STS2 Advisor.exe` — Portable executable (no installation required)

### Other Scripts

```bash
npm run build       # Build React bundle only (→ dist/)
npm run preview     # Preview production build without Electron
npm test            # Run unit tests once
npm run test:watch  # Run unit tests in watch mode
```

---

## How to Use

1. **Install the STS2MCP mod** in your Slay the Spire 2 installation
2. **Launch STS2 Advisor** (before or after starting the game)
3. The overlay connects automatically — a "Waiting for STS2..." banner appears until connection is established
4. **Start a run** — the overlay activates and displays the relevant advisory panel for the current game screen

The overlay is fully transparent and always-on-top. You play the game normally; the advisor updates in real time as game state changes.

---

## Keyboard Shortcuts

These are global shortcuts registered by the app — they work even when the game window has focus.

| Key | Action | When Active |
|---|---|---|
| **F6** | Cycle to next combat line | During combat |
| **F7** | Cycle build lens | During combat |

**Combat Lines** — The advisor generates multiple candidate play sequences per turn. F6 lets you cycle through them to see alternative approaches.

**Build Lenses** — Filter combat advice through a specific archetype lens. Available lenses:

| Lens | Focus |
|---|---|
| Auto | Adapts to detected archetype |
| Strength | Strength-scaling plays |
| Exhaust | Exhaust synergy |
| Block | Defensive/turtle |
| Poison | Poison stacking |
| Shiv | Shiv generation |
| Discard | Discard synergy |
| Orb-Focus | Orb channel/evoke |
| Frost-Control | Frost/Block hybrid |
| Lightning-Tempo | Lightning orb aggro |
| Star-Economy | Star mechanic (Regent) |
| Creation-Forging | Creation build |
| Skill-Tempo | Skill-heavy lines |
| Osty-Aggro | Osty aggression |
| Doom-Debuff | Doom debuff stacking |
| Ethereal-Tempo | Ethereal card tempo |

---

## UI Overview

### MiniDock (bottom-right corner)

Always-visible status bar showing:
- HP bar (color-coded: red <30%, yellow 30–60%, green >60%)
- Gold amount
- Energy (combat only)
- Floor / Act counter
- Deck button (toggles Deck Analysis panel)
- Potions held
- Stars (Regent/Watcher only)
- Orbs with color-coded slots (Defect only)
- Encounter badge (Monster / Elite / Boss) during combat
- Boss proximity warning when within 3 floors
- Deck archetype + power level indicator

### Combat Panel (left side, during combat)

- Threat level: low / medium / high / lethal
- Suggested play with cards/potions to use
- Current turn damage preview
- Next turn preview
- Combat lines list (cycle with F6)
- Build lens selector (cycle with F7)
- Active buffs, debuffs, and conditional effects
- Priority target in multi-enemy fights
- Potion suggestion
- Orb information (Defect)
- **Boss Intel** — readiness score, dangerous moves, counter advice, missing pieces
- **Elite Intel** — danger abilities, recommended strategy, cards to avoid, reward quality

### Card Reward Panel (left side, at rewards)

- Each card rated S–F with reasoning
- Synergy explanation per card
- Skip recommendation when no card is worth taking
- Scaling notes for high-cost cards
- Redundancy warnings
- Upcoming threat fit analysis

### Map Panel (right side, on map)

- Each reachable node scored and ranked
- Risk level indicator (low / medium / high)
- Deck-fit notes per node
- Boss prep tracking
- "Best" indicator when there is a clear winner

### Relic Panel (left side, at relic select)

- Each relic rated S–F
- Synergy explanation
- Source label if relic comes from a specific artifact

### Event Panel (left side, at events)

- Each option analyzed with a recommendation (take / avoid / situational)
- Outcome summary
- Locked/proceed status
- "Best" indicator

### Shop Panel (right side, in shop)

- Each item rated S–F with "Worth Buying" flag
- Gold affordability status: rich / okay / tight
- Removal target suggestions
- Boss urgency flag when boss is within 3 floors

### Rest Site Panel (right side, at rest site)

- Top recommendation with reasoning
- All available actions ranked by priority
- Estimated HP after resting

### Deck Panel (toggleable, top-right)

- Power level 1–10 with progress bar
- Primary and secondary archetype with confidence score
- Card type breakdown (attacks / skills / powers / curses)
- Active weaknesses (no AOE, no scaling, no draw, deck too large, etc.)
- Key synergies present in deck
- Win condition statement
- Build targets with completion percentage
- Archetype lock warning on floor ≥15 if confidence is low

---

## Advisory Engine

The engine (~6,800 lines across `src/engine/`) runs entirely client-side:

| Module | Responsibility |
|---|---|
| `card-evaluator.ts` | Card ratings using rarity base, synergy bonuses, deck needs, build targets |
| `combat-analyzer.ts` | Damage calculation, threat assessment, lethal detection |
| `combat-planner.ts` | Candidate play line generation |
| `combat-builds.ts` | Build lens definitions |
| `deck-analyzer.ts` | Power level scoring, weakness detection, win condition inference |
| `archetype-detector.ts` | Identifies primary/secondary archetype with confidence |
| `synergy-engine.ts` | Keyword-based synergy matching |
| `synergy-rules.ts` | Per-archetype synergy rule definitions |
| `meta-builds.ts` | 20+ named meta builds with core cards, synergy cards, key relics |
| `path-evaluator.ts` | Map node scoring with lookahead |
| `relic-evaluator.ts` | Relic ratings with synergy context |
| `event-evaluator.ts` | Event option scoring with outcome prediction |
| `shop-evaluator.ts` | Shop item ratings with affordability logic |
| `rest-site-evaluator.ts` | Rest action recommendations |
| `boss-advisor.ts` | Boss threat parsing, readiness score, counter advice |
| `elite-advisor.ts` | Elite danger abilities, reward quality, strategy |
| `constants.ts` | All tunable thresholds and weights |

**Archetype detection** covers 12 archetypes: strength-scaling, block-turtle, draw-engine, exhaust, orb-focus, poison, shiv, discard, powers-heavy, pet-synergy, star-engine, and balanced.

**Meta build tracking** covers 20+ named builds across all five characters (Ironclad, Silent, Defect, Regent, Necrobinder), tracking core cards, synergy cards, and key relics as the run progresses.

---

## External Integrations

### STS2 API (local, requires mod)

- Endpoint: `http://localhost:15526/api/v1/singleplayer?format=json`
- Adaptive polling: 200ms during combat, 1500ms at rewards/shop/events, 3000ms idle, 5000ms disconnected
- Provides full game state: player, battle, map, shop, inventory, etc.

### Spire Codex API (remote)

- Base URL: `https://spire-codex.com`
- Fetched once on startup, cached locally for 7 days
- Provides game metadata: cards, relics, potions, monsters, powers, encounters, events, keywords, enchantments, orbs, afflictions, ancient pools, acts, ascensions, characters, epochs
- 500ms delay between requests to respect rate limits

---

## Data & Cache

App data is stored in `%APPDATA%/sts2-advisor/`:

```
%APPDATA%/sts2-advisor/
└── codex-cache/
    ├── codex.json    # Cached Spire Codex data
    └── meta.json     # Cache timestamp (7-day TTL)
```

To force a codex refresh, delete the `codex-cache/` folder and restart the app.

---

## Project Structure

```
STSApp/
├── electron/
│   ├── main.ts              # Main process: window, polling, IPC, shortcuts
│   ├── preload.ts           # Exposes window.stsApi to renderer
│   └── state-stability.ts   # Filters transient combat state changes
├── src/
│   ├── App.tsx              # Root component, panel routing by game screen
│   ├── components/
│   │   ├── ConnectionStatus.tsx
│   │   ├── MiniDock.tsx
│   │   ├── panels/          # One panel component per game screen
│   │   └── shared/          # Reusable UI components
│   ├── engine/              # All advisory logic (~6,800 lines)
│   ├── hooks/               # useGameState, useAdvisor, useCodex
│   ├── stores/              # Zustand stores: game, settings, advisor, codex
│   ├── types/               # TypeScript interfaces
│   └── utils/               # Context resolution, damage calc, parsers
├── electron-builder.yml     # Packaging config (NSIS + portable)
├── vite.config.ts
└── vitest.config.ts
```
