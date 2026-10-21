import { BUILDINGS, levelDef } from './data/buildings';
import { storageCap } from './state';
import type { Building, GameState, Resource } from './types';

/** Uncollected production sitting in a collector right now. */
export function pendingProduction(b: Building, now: number): number {
  const def = BUILDINGS[b.kind];
  if (def.category !== 'resource' || b.lastCollectAt === undefined) return 0;
  const lv = levelDef(b.kind, b.level);
  const hours = Math.max(0, now - b.lastCollectAt) / 3_600_000;
  return Math.min(lv.collectorCap ?? 0, Math.floor((lv.prod ?? 0) * hours));
}

export function add(state: GameState, res: Resource, amount: number): number {
  const cap = storageCap(state, res);
  const before = state.resources[res];
  state.resources[res] = Math.min(cap, before + amount);
  return state.resources[res] - before;
}

export function canAfford(state: GameState, res: Resource, amount: number): boolean {
  return state.resources[res] >= amount;
}

export function spend(state: GameState, res: Resource, amount: number): boolean {
  if (!canAfford(state, res, amount)) return false;
  state.resources[res] -= amount;
  return true;
}

/** Collects a collector into storage. Returns how much actually fit. */
export function collect(state: GameState, b: Building, now: number): number {
  const def = BUILDINGS[b.kind];
  if (def.category !== 'resource' || !def.resource) return 0;
  const pending = pendingProduction(b, now);
  if (pending <= 0) return 0;
  const taken = add(state, def.resource, pending);
  const lv = levelDef(b.kind, b.level);
  const remainder = pending - taken;
  // Keep whatever did not fit inside the collector by rewinding its clock.
  const msPerUnit = 3_600_000 / Math.max(1, lv.prod ?? 1);
  b.lastCollectAt = now - Math.floor(remainder * msPerUnit);
  return taken;
}

export function collectAll(state: GameState, now: number): { wood: number; stone: number } {
  const out = { wood: 0, stone: 0 };
  for (const b of state.buildings) {
    const def = BUILDINGS[b.kind];
    if (def.category === 'resource' && def.resource) out[def.resource] += collect(state, b, now);
  }
  return out;
}

/** Ash needed to finish a timer with `remainingMs` left. */
export function skipCost(remainingMs: number): number {
  const sec = Math.max(0, remainingMs / 1000);
  if (sec <= 0) return 0;
  // 1 Ash per 3 minutes for short timers, flattening to 1 per 10 minutes past a day.
  if (sec <= 3600) return Math.max(1, Math.ceil(sec / 180));
  if (sec <= 86400) return Math.ceil(20 + (sec - 3600) / 360);
  return Math.ceil(250 + (sec - 86400) / 600);
}
