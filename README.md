# Emberhold

A Clash of Clans-style village builder with a deliberately grindy late game.
The design is in [`docs/GAME_CONCEPT.md`](docs/GAME_CONCEPT.md). This
repository holds the MVP vertical slice described in its §13.

## Running it

```
npm install
npm run dev        # http://localhost:5173
npm test           # vitest unit tests for the simulation core
npm run build      # typecheck + production build into dist/
```

Add `?dev` to the URL for a dev panel (Log → Settings) with time-skip
buttons, free resources, and a "Night raid" button that simulates coming
back after four hours away.

## What is in the slice

- Hall levels 1 to 5, with building count and level caps per Hall tier.
- Buildings: Ember Hall, Quarry, Lumber Camp, Stone Store, Wood Store,
  Barracks, Archer Post, Walls, Builder's Hut.
- Resources: Wood and Stone (collected by tapping), Ash as premium currency.
- Timers for building and upgrading. One builder to start, a second hut
  for Ash. Walls upgrade instantly and need no builder.
- Troops: Militia, Slinger, Goat Rider. Trained from a queue, housed in
  Barracks, consumed on attack.
- Raiding five pre-built AI villages (one per Hall tier). Tap to deploy,
  watch the battle, loot drips out as you deal damage. Three-star scoring.
  First-time stars pay Ash.
- AI counter-raids when you have been away 3+ hours without a shield.
- Local save in `localStorage`. Timers and production are timestamp-based,
  so everything progresses while the tab is closed.

Not in the slice (by design): clans, heroes, Ember, the storyline layer,
real PvP, research.

## Layout

```
src/game/           simulation core, no DOM
  data/             building, troop and AI village tables
  battle/           A* pathfinding and the tick-based battle sim
  state.ts          GameState, placement helpers, capacity sums
  economy.ts        production, storage, Ash skip pricing
  build.ts          buy / upgrade / cancel / finish-with-Ash
  army.ts           training queue
  raid.ts           loot tables, applying results, counter-raids
  save.ts           localStorage persistence, dev time shift
src/ui/             canvas renderer, village screen, battle screen
src/main.ts         boot, game loop, HUD, settings
tests/              vitest suites for every core module
```

## Controls

- Tap a building to select it. Tap a selected Quarry or Lumber Camp again
  to collect.
- Shop → Place, then tap a free tile. Walls use paint mode: keep tapping,
  then press Done.
- Army → train, then Attack → Scout a village → tap the tinted ground to
  deploy. The clock starts with the first troop.
