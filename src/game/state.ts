import { BUILDINGS, levelDef } from './data/buildings';
import type { Building, BuildingKind, GameState, Resource } from './types';
import { GRID } from './types';

export const SAVE_VERSION = 1;

export function newGame(now: number): GameState {
  const state: GameState = {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeenAt: now,
    resources: { wood: 600, stone: 600, ash: 300 },
    builders: 1,
    nextId: 1,
    buildings: [],
    army: { troops: { militia: 0, slinger: 0, goat_rider: 0 }, queue: [] },
    villageStars: {},
    raidLog: [],
    shieldUntil: 0,
    stats: { raids: 0, starsTotal: 0, lootWood: 0, lootStone: 0 },
  };
  const mid = Math.floor(GRID / 2);
  addBuilding(state, 'hall', 1, mid - 1, mid - 1, now);
  addBuilding(state, 'builder_hut', 1, mid + 3, mid - 1, now);
  addBuilding(state, 'quarry', 1, mid - 5, mid - 1, now);
  addBuilding(state, 'lumber', 1, mid - 5, mid + 2, now);
  return state;
}

export function addBuilding(state: GameState, kind: BuildingKind, level: number, x: number, y: number, now: number): Building {
  const b: Building = { id: state.nextId++, kind, level, x, y };
  if (BUILDINGS[kind].category === 'resource') b.lastCollectAt = now;
  state.buildings.push(b);
  return b;
}

export function hall(state: GameState): Building {
  const h = state.buildings.find((b) => b.kind === 'hall');
  if (!h) throw new Error('village has no hall');
  return h;
}

export function hallLevel(state: GameState): number {
  return hall(state).level;
}

export function countOf(state: GameState, kind: BuildingKind): number {
  return state.buildings.filter((b) => b.kind === kind).length;
}

export function byId(state: GameState, id: number): Building | undefined {
  return state.buildings.find((b) => b.id === id);
}

/** Total capacity for a resource: hall storage plus every store for that resource. */
export function storageCap(state: GameState, res: Resource): number {
  let cap = 0;
  for (const b of state.buildings) {
    const def = BUILDINGS[b.kind];
    const lv = levelDef(b.kind, b.level);
    if (b.kind === 'hall') cap += lv.storage ?? 0;
    else if (def.category === 'storage' && def.resource === res) cap += lv.storage ?? 0;
  }
  return cap;
}

export function troopCapacity(state: GameState): number {
  let cap = 0;
  for (const b of state.buildings) if (b.kind === 'barracks') cap += levelDef(b.kind, b.level).housing ?? 0;
  return cap;
}

export function busyBuilders(state: GameState): number {
  return state.buildings.filter((b) => b.upgrade && BUILDINGS[b.kind].needsBuilder).length;
}

export function freeBuilders(state: GameState): number {
  return state.builders - busyBuilders(state);
}

/** Footprint check helpers shared by placement and the battle grid. */
export function footprint(b: { kind: BuildingKind; x: number; y: number }): { x0: number; y0: number; x1: number; y1: number } {
  const s = BUILDINGS[b.kind].size;
  return { x0: b.x, y0: b.y, x1: b.x + s - 1, y1: b.y + s - 1 };
}

export function overlaps(a: { kind: BuildingKind; x: number; y: number }, b: { kind: BuildingKind; x: number; y: number }): boolean {
  const fa = footprint(a);
  const fb = footprint(b);
  return fa.x0 <= fb.x1 && fb.x0 <= fa.x1 && fa.y0 <= fb.y1 && fb.y0 <= fa.y1;
}

export function inBounds(kind: BuildingKind, x: number, y: number): boolean {
  const s = BUILDINGS[kind].size;
  return x >= 0 && y >= 0 && x + s <= GRID && y + s <= GRID;
}

export function canPlaceAt(state: GameState, kind: BuildingKind, x: number, y: number, ignoreId?: number): boolean {
  if (!inBounds(kind, x, y)) return false;
  const probe = { kind, x, y };
  return !state.buildings.some((b) => b.id !== ignoreId && overlaps(probe, b));
}

export function buildingAt(state: GameState, x: number, y: number): Building | undefined {
  return state.buildings.find((b) => {
    const f = footprint(b);
    return x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1;
  });
}
