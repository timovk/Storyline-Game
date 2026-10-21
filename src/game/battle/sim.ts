import { BUILDINGS, levelDef } from '../data/buildings';
import { BATTLE_SECONDS, TROOPS } from '../data/troops';
import { makeRng } from '../rng';
import type { Building, BuildingKind, TroopKind } from '../types';
import { findPath, type Tile } from './pathfinding';

export const TICK = 0.1; // seconds of battle time per step

export interface Loot {
  wood: number;
  stone: number;
}

export interface BattleBuilding {
  id: number;
  kind: BuildingKind;
  level: number;
  x: number;
  y: number;
  size: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  loot: Loot;
  lootGiven: Loot;
  dps: number;
  range: number;
  nextShotAt: number;
  targetUnit?: number;
}

export interface BattleUnit {
  id: number;
  kind: TroopKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  targetId?: number;
  path: Tile[];
  /** Building (or wall) currently being hit. */
  attackingId?: number;
  nextHitAt: number;
}

export type EndReason = 'time' | 'destroyed' | 'army_spent' | 'ended';

export interface BattleState {
  grid: number;
  buildings: BattleBuilding[];
  units: BattleUnit[];
  remaining: Record<TroopKind, number>;
  t: number;
  started: boolean;
  over: boolean;
  endReason?: EndReason;
  loot: Loot;
  totalBuildings: number;
  destroyedBuildings: number;
  hallDestroyed: boolean;
  deployable: Uint8Array;
  occ: Int32Array;
  rng: () => number;
  nextUnitId: number;
  /** Timestamped lines for the battle log UI. */
  events: string[];
}

export interface BattleSetup {
  grid: number;
  buildings: Building[];
  lootOf: (b: Building) => Loot;
  army: Record<TroopKind, number>;
  seed: number;
}

export function createBattle(setup: BattleSetup): BattleState {
  const buildings: BattleBuilding[] = setup.buildings
    .filter((b) => b.level > 0 || b.upgrade)
    .map((b) => {
      const level = Math.max(1, b.level);
      const lv = levelDef(b.kind, level);
      return {
        id: b.id,
        kind: b.kind,
        level,
        x: b.x,
        y: b.y,
        size: BUILDINGS[b.kind].size,
        hp: lv.hp,
        maxHp: lv.hp,
        alive: true,
        loot: setup.lootOf(b),
        lootGiven: { wood: 0, stone: 0 },
        dps: lv.dps ?? 0,
        range: lv.range ?? 0,
        nextShotAt: 0,
      };
    });
  const bs: BattleState = {
    grid: setup.grid,
    buildings,
    units: [],
    remaining: { ...setup.army },
    t: 0,
    started: false,
    over: false,
    loot: { wood: 0, stone: 0 },
    totalBuildings: buildings.filter((b) => b.kind !== 'wall').length,
    destroyedBuildings: 0,
    hallDestroyed: false,
    deployable: new Uint8Array(setup.grid * setup.grid),
    occ: new Int32Array(setup.grid * setup.grid).fill(-1),
    rng: makeRng(setup.seed),
    nextUnitId: 1,
    events: [],
  };
  rebuildOccupancy(bs);
  computeDeployable(bs);
  return bs;
}

function rebuildOccupancy(bs: BattleState): void {
  bs.occ.fill(-1);
  for (const b of bs.buildings) {
    if (!b.alive) continue;
    for (let y = b.y; y < b.y + b.size; y++) for (let x = b.x; x < b.x + b.size; x++) bs.occ[y * bs.grid + x] = b.id;
  }
}

/** A tile is deployable when it is outside every wall enclosure and clear of buildings. */
function computeDeployable(bs: BattleState): void {
  const n = bs.grid;
  const byId = new Map(bs.buildings.map((b) => [b.id, b]));
  const outside = new Uint8Array(n * n);
  const stack: number[] = [];
  const tryPush = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const i = y * n + x;
    if (outside[i]) return;
    const id = bs.occ[i];
    if (id >= 0) {
      const b = byId.get(id)!;
      if (b.kind === 'wall') return;
    }
    outside[i] = 1;
    stack.push(i);
  };
  for (let i = 0; i < n; i++) {
    tryPush(i, 0);
    tryPush(i, n - 1);
    tryPush(0, i);
    tryPush(n - 1, i);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % n;
    const y = (i - x) / n;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }
  bs.deployable.fill(0);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (!outside[i] || bs.occ[i] >= 0) continue;
      let clear = true;
      for (const b of bs.buildings) {
        if (!b.alive || b.kind === 'wall') continue;
        if (x >= b.x - 1 && x <= b.x + b.size && y >= b.y - 1 && y <= b.y + b.size) {
          clear = false;
          break;
        }
      }
      bs.deployable[i] = clear ? 1 : 0;
    }
  }
}

export function canDeploy(bs: BattleState, kind: TroopKind, x: number, y: number): boolean {
  if (bs.over) return false;
  if (x < 0 || y < 0 || x >= bs.grid || y >= bs.grid) return false;
  if (bs.remaining[kind] <= 0) return false;
  return bs.deployable[y * bs.grid + x] === 1;
}

export function deploy(bs: BattleState, kind: TroopKind, x: number, y: number): BattleUnit | null {
  if (!canDeploy(bs, kind, x, y)) return null;
  const def = TROOPS[kind];
  bs.remaining[kind] -= 1;
  const u: BattleUnit = {
    id: bs.nextUnitId++,
    kind,
    x: x + 0.5 + (bs.rng() - 0.5) * 0.4,
    y: y + 0.5 + (bs.rng() - 0.5) * 0.4,
    hp: def.hp,
    maxHp: def.hp,
    alive: true,
    path: [],
    nextHitAt: 0,
  };
  bs.units.push(u);
  bs.started = true;
  return u;
}

export function remainingTroops(bs: BattleState): number {
  return bs.remaining.militia + bs.remaining.slinger + bs.remaining.goat_rider;
}

export function destruction(bs: BattleState): number {
  return bs.totalBuildings === 0 ? 1 : bs.destroyedBuildings / bs.totalBuildings;
}

export function stars(bs: BattleState): number {
  const d = destruction(bs);
  return (d >= 0.5 ? 1 : 0) + (bs.hallDestroyed ? 1 : 0) + (d >= 1 ? 1 : 0);
}

export function timeLeft(bs: BattleState): number {
  return Math.max(0, BATTLE_SECONDS - bs.t);
}

export function endBattle(bs: BattleState, reason: EndReason = 'ended'): void {
  if (bs.over) return;
  bs.over = true;
  bs.endReason = reason;
}

/** Distance from a point to the nearest edge of a building footprint (0 when inside). */
function distToBuilding(px: number, py: number, b: BattleBuilding): number {
  const dx = Math.max(b.x - px, 0, px - (b.x + b.size));
  const dy = Math.max(b.y - py, 0, py - (b.y + b.size));
  return Math.hypot(dx, dy);
}

function pickTarget(bs: BattleState, u: BattleUnit): BattleBuilding | undefined {
  const def = TROOPS[u.kind];
  let pool = bs.buildings.filter((b) => b.alive && b.kind !== 'wall');
  if (def.prefers === 'defense') {
    const defs = pool.filter((b) => b.dps > 0);
    if (defs.length) pool = defs;
  }
  let best: BattleBuilding | undefined;
  let bestD = Infinity;
  for (const b of pool) {
    const d = distToBuilding(u.x, u.y, b);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function planPath(bs: BattleState, u: BattleUnit, target: BattleBuilding): void {
  const def = TROOPS[u.kind];
  const byId = new Map(bs.buildings.map((b) => [b.id, b]));
  const unitDps = def.damage / def.hitEvery;
  const path = findPath({
    grid: bs.grid,
    start: { x: Math.floor(u.x), y: Math.floor(u.y) },
    stepCost: (x, y) => {
      const id = bs.occ[y * bs.grid + x];
      if (id < 0) return 1;
      const b = byId.get(id)!;
      if (!b.alive) return 1;
      if (b.kind === 'wall') return 1 + (b.hp / unitDps) * def.speed;
      return Infinity;
    },
    isGoal: (x, y) => distToBuilding(x + 0.5, y + 0.5, target) <= def.range,
    heuristic: (x, y) => Math.max(0, distToBuilding(x + 0.5, y + 0.5, target) - def.range),
  });
  u.path = path ?? [];
}

function damageBuilding(bs: BattleState, b: BattleBuilding, amount: number, byUnit: BattleUnit): void {
  if (!b.alive) return;
  const dealt = Math.min(b.hp, amount);
  b.hp -= dealt;
  // Loot drips out in proportion to damage.
  for (const res of ['wood', 'stone'] as const) {
    const share = Math.floor((b.loot[res] * (b.maxHp - b.hp)) / b.maxHp) - b.lootGiven[res];
    if (share > 0) {
      b.lootGiven[res] += share;
      bs.loot[res] += share;
    }
  }
  if (b.hp <= 0) {
    b.alive = false;
    for (const res of ['wood', 'stone'] as const) {
      const rest = b.loot[res] - b.lootGiven[res];
      if (rest > 0) {
        b.lootGiven[res] += rest;
        bs.loot[res] += rest;
      }
    }
    if (b.kind !== 'wall') {
      bs.destroyedBuildings += 1;
      if (b.kind === 'hall') bs.hallDestroyed = true;
      bs.events.push(`${fmt(bs.t)} ${BUILDINGS[b.kind].name} destroyed by ${TROOPS[byUnit.kind].name}`);
    }
    rebuildOccupancy(bs);
    for (const o of bs.units) {
      if (o.attackingId === b.id) o.attackingId = undefined;
      if (o.targetId === b.id) {
        o.targetId = undefined;
        o.path = [];
      }
    }
  }
}

function fmt(t: number): string {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function stepUnit(bs: BattleState, u: BattleUnit, byId: Map<number, BattleBuilding>): void {
  const def = TROOPS[u.kind];

  // Keep hitting whatever we are already attacking.
  if (u.attackingId !== undefined) {
    const b = byId.get(u.attackingId);
    if (b && b.alive && distToBuilding(u.x, u.y, b) <= def.range + 0.05) {
      if (bs.t >= u.nextHitAt) {
        damageBuilding(bs, b, def.damage, u);
        u.nextHitAt = bs.t + def.hitEvery;
      }
      return;
    }
    u.attackingId = undefined;
  }

  // Need a target?
  let target = u.targetId !== undefined ? byId.get(u.targetId) : undefined;
  if (!target || !target.alive) {
    target = pickTarget(bs, u);
    if (!target) return;
    u.targetId = target.id;
    planPath(bs, u, target);
  }

  // In range of the target? Attack it.
  if (distToBuilding(u.x, u.y, target) <= def.range) {
    u.attackingId = target.id;
    u.nextHitAt = Math.max(u.nextHitAt, bs.t + def.hitEvery * 0.3);
    return;
  }

  if (u.path.length === 0) {
    planPath(bs, u, target);
    if (u.path.length === 0) {
      // Nothing reachable; stand and hit the closest wall if any.
      return;
    }
  }

  const next = u.path[0];
  const occId = bs.occ[next.y * bs.grid + next.x];
  if (occId >= 0) {
    const blocker = byId.get(occId)!;
    if (blocker.alive && blocker.kind === 'wall') {
      // Hit the wall from where we stand once it is in reach.
      if (distToBuilding(u.x, u.y, blocker) <= def.range + 0.05) {
        u.attackingId = blocker.id;
        return;
      }
    } else if (blocker.alive) {
      // A building moved into our path (should not happen); re-plan.
      planPath(bs, u, target);
      return;
    }
  }

  // Move toward the centre of the next tile.
  const tx = next.x + 0.5;
  const ty = next.y + 0.5;
  const dx = tx - u.x;
  const dy = ty - u.y;
  const dist = Math.hypot(dx, dy);
  const step = def.speed * TICK;
  if (dist <= step) {
    u.x = tx;
    u.y = ty;
    u.path.shift();
  } else {
    u.x += (dx / dist) * step;
    u.y += (dy / dist) * step;
  }
}

function stepDefense(bs: BattleState, b: BattleBuilding): void {
  if (!b.alive || b.dps <= 0) return;
  const cx = b.x + b.size / 2;
  const cy = b.y + b.size / 2;
  let target = b.targetUnit !== undefined ? bs.units.find((u) => u.id === b.targetUnit) : undefined;
  if (!target || !target.alive || Math.hypot(target.x - cx, target.y - cy) > b.range) {
    target = undefined;
    let bestD = Infinity;
    for (const u of bs.units) {
      if (!u.alive) continue;
      const d = Math.hypot(u.x - cx, u.y - cy);
      if (d <= b.range && d < bestD) {
        bestD = d;
        target = u;
      }
    }
    b.targetUnit = target?.id;
  }
  if (!target) return;
  if (bs.t >= b.nextShotAt) {
    target.hp -= b.dps;
    b.nextShotAt = bs.t + 1;
    if (target.hp <= 0) {
      target.alive = false;
      b.targetUnit = undefined;
    }
  }
}

/** Advances the battle by one tick. Safe to call after the battle is over. */
export function step(bs: BattleState): void {
  if (bs.over || !bs.started) return;
  const byId = new Map(bs.buildings.map((b) => [b.id, b]));
  for (const u of bs.units) if (u.alive) stepUnit(bs, u, byId);
  for (const b of bs.buildings) stepDefense(bs, b);
  bs.t += TICK;

  if (bs.destroyedBuildings >= bs.totalBuildings) return endBattle(bs, 'destroyed');
  if (bs.t >= BATTLE_SECONDS) return endBattle(bs, 'time');
  if (remainingTroops(bs) === 0 && !bs.units.some((u) => u.alive)) return endBattle(bs, 'army_spent');
}

/** Runs the battle to completion without rendering. Used for AI counter-raids and tests. */
export function runToEnd(bs: BattleState, maxSteps = 20000): void {
  for (let i = 0; i < maxSteps && !bs.over; i++) step(bs);
  if (!bs.over) endBattle(bs, 'time');
}

export function unitsLost(bs: BattleState): number {
  return bs.units.filter((u) => !u.alive).length;
}

/** Picks a random deployable tile, preferring the grid edges. Used by the AI attacker. */
export function randomDeployTile(bs: BattleState): Tile | null {
  const tiles: Tile[] = [];
  for (let y = 0; y < bs.grid; y++) for (let x = 0; x < bs.grid; x++) if (bs.deployable[y * bs.grid + x]) tiles.push({ x, y });
  if (tiles.length === 0) return null;
  return tiles[Math.floor(bs.rng() * tiles.length)];
}
