import { describe, expect, it } from 'vitest';
import { collect, pendingProduction, skipCost } from '../src/game/economy';
import { newGame, storageCap } from '../src/game/state';
import { levelDef } from '../src/game/data/buildings';

const T0 = 1_700_000_000_000;

describe('economy', () => {
  it('collectors accumulate over time and are capped', () => {
    const s = newGame(T0);
    const q = s.buildings.find((b) => b.kind === 'quarry')!;
    const lv = levelDef('quarry', 1);
    expect(pendingProduction(q, T0)).toBe(0);
    expect(pendingProduction(q, T0 + 3_600_000)).toBe(lv.prod);
    expect(pendingProduction(q, T0 + 100 * 3_600_000)).toBe(lv.collectorCap);
  });

  it('collecting respects storage and keeps the remainder in the collector', () => {
    const s = newGame(T0);
    const q = s.buildings.find((b) => b.kind === 'quarry')!;
    const cap = storageCap(s, 'stone');
    s.resources.stone = cap - 50;
    const later = T0 + 8 * 3_600_000; // collector full
    const taken = collect(s, q, later);
    expect(taken).toBe(50);
    expect(s.resources.stone).toBe(cap);
    const lv = levelDef('quarry', 1);
    expect(pendingProduction(q, later)).toBe(lv.collectorCap! - 50);
  });

  it('skip cost grows with remaining time but flattens', () => {
    expect(skipCost(0)).toBe(0);
    expect(skipCost(60_000)).toBe(1);
    expect(skipCost(3_600_000)).toBe(20);
    expect(skipCost(86_400_000)).toBe(250);
    expect(skipCost(2 * 86_400_000)).toBe(250 + 144);
  });
});
