import { BUILDINGS, levelDef } from './data/buildings';
import { TROOPS } from './data/troops';
import { availableVillages, type AiVillage } from './data/villages';
import { pendingProduction, add } from './economy';
import { hallLevel, storageCap } from './state';
import type { Building, GameState, RaidReport, TroopKind } from './types';
import { GRID } from './types';
import {
  createBattle,
  deploy,
  destruction,
  randomDeployTile,
  runToEnd,
  stars,
  unitsLost,
  type BattleState,
  type Loot,
} from './battle/sim';

export const ASH_PER_NEW_STAR = 10;
export const COUNTER_RAID_AFTER_MS = 3 * 3_600_000;
export const SHIELD_HEAVY_MS = 8 * 3_600_000;
export const SHIELD_LIGHT_MS = 2 * 3_600_000;

/** Distributes an AI village's loot evenly over its hall, stores and collectors. */
export function aiLootTable(v: AiVillage): (b: Building) => Loot {
  const holders = v.buildings.filter((b) => ['hall', 'storage', 'resource'].includes(BUILDINGS[b.kind].category));
  const n = Math.max(1, holders.length);
  return (b) => {
    if (!holders.includes(b)) return { wood: 0, stone: 0 };
    return { wood: Math.floor(v.loot.wood / n), stone: Math.floor(v.loot.stone / n) };
  };
}

/** What a raider could take from the player's own village right now. */
export function playerLootTable(state: GameState, now: number): (b: Building) => Loot {
  const LOOT_RATE_STORED = 0.2;
  const LOOT_RATE_COLLECTOR = 0.5;
  const capWood = Math.max(1, storageCap(state, 'wood'));
  const capStone = Math.max(1, storageCap(state, 'stone'));
  return (b) => {
    const def = BUILDINGS[b.kind];
    const lv = levelDef(b.kind, Math.max(1, b.level));
    if (b.kind === 'hall') {
      const s = lv.storage ?? 0;
      return {
        wood: Math.floor((state.resources.wood * LOOT_RATE_STORED * s) / capWood),
        stone: Math.floor((state.resources.stone * LOOT_RATE_STORED * s) / capStone),
      };
    }
    if (def.category === 'storage') {
      const s = lv.storage ?? 0;
      const res = def.resource!;
      const amount = Math.floor((state.resources[res] * LOOT_RATE_STORED * s) / (res === 'wood' ? capWood : capStone));
      return { wood: res === 'wood' ? amount : 0, stone: res === 'stone' ? amount : 0 };
    }
    if (def.category === 'resource') {
      const amount = Math.floor(pendingProduction(b, now) * LOOT_RATE_COLLECTOR);
      return { wood: def.resource === 'wood' ? amount : 0, stone: def.resource === 'stone' ? amount : 0 };
    }
    return { wood: 0, stone: 0 };
  };
}

export function startRaid(state: GameState, v: AiVillage, seed: number): BattleState {
  return createBattle({
    grid: GRID,
    buildings: v.buildings,
    lootOf: aiLootTable(v),
    army: { ...state.army.troops },
    seed,
  });
}

/** Applies a finished attack to the player's village: loot in, troops gone, Ash for new stars. */
export function applyRaidResult(state: GameState, v: AiVillage, bs: BattleState, now: number): RaidReport {
  const got = { wood: add(state, 'wood', bs.loot.wood), stone: add(state, 'stone', bs.loot.stone) };
  // Deployed troops are spent; whatever stayed in the barracks stays.
  state.army.troops = { ...bs.remaining };
  const s = stars(bs);
  const prev = state.villageStars[v.id] ?? 0;
  const ash = Math.max(0, s - prev) * ASH_PER_NEW_STAR;
  state.resources.ash += ash;
  state.villageStars[v.id] = Math.max(prev, s);
  state.stats.raids += 1;
  state.stats.starsTotal += s;
  state.stats.lootWood += got.wood;
  state.stats.lootStone += got.stone;
  const report: RaidReport = {
    at: now,
    villageId: v.id,
    villageName: v.name,
    direction: 'attack',
    stars: s,
    destruction: destruction(bs),
    loot: got,
    ashEarned: ash,
    troopsLost: unitsLost(bs),
  };
  pushReport(state, report);
  return report;
}

function pushReport(state: GameState, r: RaidReport): void {
  state.raidLog.unshift(r);
  if (state.raidLog.length > 20) state.raidLog.length = 20;
}

/** Army an AI raider brings against a village of the given hall level. */
export function counterRaidArmy(hall: number): Record<TroopKind, number> {
  return {
    militia: 4 + hall * 3,
    slinger: hall >= 2 ? hall * 2 : 0,
    goat_rider: hall >= 3 ? hall - 1 : 0,
  };
}

/**
 * If the player has been away long enough and has no shield, a nearby AI clan
 * raids them. Returns the report, or null when nothing happened.
 */
export function maybeCounterRaid(state: GameState, now: number, seed = now): RaidReport | null {
  if (now - state.lastSeenAt < COUNTER_RAID_AFTER_MS) return null;
  if (state.shieldUntil > now) return null;
  const hall = hallLevel(state);
  const army = counterRaidArmy(hall);
  const bs = createBattle({ grid: GRID, buildings: state.buildings, lootOf: playerLootTable(state, now), army, seed });
  // Deploy the whole army over a few spots, then let it run.
  const spots = [randomDeployTile(bs), randomDeployTile(bs), randomDeployTile(bs)].filter((t): t is NonNullable<typeof t> => !!t);
  if (spots.length === 0) return null;
  let i = 0;
  for (const kind of ['militia', 'slinger', 'goat_rider'] as TroopKind[]) {
    for (let n = 0; n < army[kind]; n++) {
      const t = spots[i++ % spots.length];
      deploy(bs, kind, t.x, t.y);
    }
  }
  runToEnd(bs);
  // Take the loot out of the village: stored loot comes out of the stockpile,
  // collector loot comes out of the collector by advancing its clock.
  for (const b of bs.buildings) {
    const src = state.buildings.find((o) => o.id === b.id);
    if (!src) continue;
    const category = BUILDINGS[src.kind].category;
    if (category === 'resource') {
      if (src.lastCollectAt === undefined) continue;
      const lv = levelDef(src.kind, Math.max(1, src.level));
      const taken = b.lootGiven.wood + b.lootGiven.stone;
      src.lastCollectAt += Math.floor((taken * 3_600_000) / Math.max(1, lv.prod ?? 1));
    } else {
      state.resources.wood = Math.max(0, state.resources.wood - b.lootGiven.wood);
      state.resources.stone = Math.max(0, state.resources.stone - b.lootGiven.stone);
    }
  }
  const d = destruction(bs);
  state.shieldUntil = now + (d >= 0.5 ? SHIELD_HEAVY_MS : SHIELD_LIGHT_MS);
  const attackerNames = availableVillages(hall);
  const attacker = attackerNames[Math.floor(bs.rng() * attackerNames.length)];
  const report: RaidReport = {
    at: now,
    villageId: attacker.id,
    villageName: attacker.name,
    direction: 'defense',
    stars: stars(bs),
    destruction: d,
    loot: { ...bs.loot },
    ashEarned: 0,
    troopsLost: Object.values(army).reduce((a, b) => a + b, 0) - unitsLost(bs),
  };
  pushReport(state, report);
  return report;
}

export function troopName(kind: TroopKind): string {
  return TROOPS[kind].name;
}
