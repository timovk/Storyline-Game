import { BUILDINGS, levelDef, maxCount, maxLevel, SECOND_BUILDER_ASH } from './data/buildings';
import { skipCost, spend } from './economy';
import { addBuilding, canPlaceAt, countOf, freeBuilders, hallLevel } from './state';
import type { Building, BuildingKind, GameState } from './types';

export type Refusal =
  | 'ok'
  | 'locked'
  | 'count'
  | 'max_level'
  | 'hall_cap'
  | 'no_builder'
  | 'resources'
  | 'busy'
  | 'placement'
  | 'ash';

export interface BuildCheck {
  result: Refusal;
  cost: number;
  time: number;
}

/** Whether a new building of this kind could be bought right now (ignoring placement). */
export function checkBuy(state: GameState, kind: BuildingKind): BuildCheck {
  const def = BUILDINGS[kind];
  const lv = def.levels[0];
  const hl = hallLevel(state);
  const out: BuildCheck = { result: 'ok', cost: lv.cost, time: lv.time };
  if (kind === 'hall') return { ...out, result: 'count' };
  if (kind === 'builder_hut') {
    out.cost = SECOND_BUILDER_ASH;
    if (countOf(state, kind) >= maxCount(kind, hl)) return { ...out, result: 'count' };
    if (state.resources.ash < SECOND_BUILDER_ASH) return { ...out, result: 'ash' };
    return out;
  }
  if (hl < def.unlockHall) return { ...out, result: 'locked' };
  if (countOf(state, kind) >= maxCount(kind, hl)) return { ...out, result: 'count' };
  if (def.needsBuilder && lv.time > 0 && freeBuilders(state) <= 0) return { ...out, result: 'no_builder' };
  if (state.resources[def.costResource] < lv.cost) return { ...out, result: 'resources' };
  return out;
}

/** Buys and places a new building. Level 1 construction uses a builder like an upgrade would. */
export function buy(state: GameState, kind: BuildingKind, x: number, y: number, now: number): Building | Refusal {
  const check = checkBuy(state, kind);
  if (check.result !== 'ok') return check.result;
  if (!canPlaceAt(state, kind, x, y)) return 'placement';
  const def = BUILDINGS[kind];
  if (kind === 'builder_hut') {
    if (!spendAsh(state, SECOND_BUILDER_ASH)) return 'ash';
    const hut = addBuilding(state, kind, 1, x, y, now);
    state.builders += 1;
    return hut;
  }
  if (!spend(state, def.costResource, check.cost)) return 'resources';
  // New buildings start at level 0 and "upgrade" to 1 so they share the timer path.
  const b = addBuilding(state, kind, 1, x, y, now);
  if (check.time > 0) {
    b.level = 0;
    b.upgrade = { toLevel: 1, startedAt: now, finishAt: now + check.time * 1000 };
  }
  return b;
}

function spendAsh(state: GameState, amount: number): boolean {
  if (state.resources.ash < amount) return false;
  state.resources.ash -= amount;
  return true;
}

export function checkUpgrade(state: GameState, b: Building): BuildCheck {
  const def = BUILDINGS[b.kind];
  const next = b.level + 1;
  const out: BuildCheck = { result: 'ok', cost: 0, time: 0 };
  if (b.upgrade) return { ...out, result: 'busy' };
  if (next > def.levels.length) return { ...out, result: 'max_level' };
  const lv = levelDef(b.kind, next);
  out.cost = lv.cost;
  out.time = lv.time;
  if (next > maxLevel(b.kind, hallLevel(state))) return { ...out, result: 'hall_cap' };
  if (def.needsBuilder && lv.time > 0 && freeBuilders(state) <= 0) return { ...out, result: 'no_builder' };
  if (state.resources[def.costResource] < lv.cost) return { ...out, result: 'resources' };
  return out;
}

export function upgrade(state: GameState, b: Building, now: number): Refusal {
  const check = checkUpgrade(state, b);
  if (check.result !== 'ok') return check.result;
  const def = BUILDINGS[b.kind];
  spend(state, def.costResource, check.cost);
  if (check.time <= 0) {
    b.level += 1;
    return 'ok';
  }
  b.upgrade = { toLevel: b.level + 1, startedAt: now, finishAt: now + check.time * 1000 };
  return 'ok';
}

export function cancelUpgrade(state: GameState, b: Building): boolean {
  if (!b.upgrade) return false;
  const def = BUILDINGS[b.kind];
  const lv = levelDef(b.kind, b.upgrade.toLevel);
  // Half refund, as in the genre; new buildings that are cancelled disappear.
  state.resources[def.costResource] = Math.min(
    state.resources[def.costResource] + Math.floor(lv.cost / 2),
    Number.MAX_SAFE_INTEGER,
  );
  if (b.level === 0) state.buildings = state.buildings.filter((o) => o.id !== b.id);
  else b.upgrade = undefined;
  return true;
}

export function finishWithAsh(state: GameState, b: Building, now: number): Refusal {
  if (!b.upgrade) return 'busy';
  const cost = skipCost(b.upgrade.finishAt - now);
  if (!spendAsh(state, cost)) return 'ash';
  b.upgrade.finishAt = now;
  settleUpgrades(state, now);
  return 'ok';
}

/** Completes every upgrade whose timer has elapsed. Returns the finished buildings. */
export function settleUpgrades(state: GameState, now: number): Building[] {
  const done: Building[] = [];
  for (const b of state.buildings) {
    if (b.upgrade && b.upgrade.finishAt <= now) {
      const wasHall = b.kind === 'hall';
      b.level = b.upgrade.toLevel;
      b.upgrade = undefined;
      if (BUILDINGS[b.kind].category === 'resource' && b.lastCollectAt === undefined) b.lastCollectAt = now;
      if (wasHall) state.resources.ash += 50;
      done.push(b);
    }
  }
  return done;
}

export function moveBuilding(state: GameState, b: Building, x: number, y: number): boolean {
  if (!canPlaceAt(state, b.kind, x, y, b.id)) return false;
  b.x = x;
  b.y = y;
  return true;
}
