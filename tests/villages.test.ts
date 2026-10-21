import { describe, expect, it } from 'vitest';
import { VILLAGES, availableVillages } from '../src/game/data/villages';
import { BUILDINGS, maxCount, maxLevel } from '../src/game/data/buildings';
import { inBounds, overlaps } from '../src/game/state';
import type { BuildingKind } from '../src/game/types';

describe('AI villages', () => {
  it('have no overlaps, stay in bounds and have one hall', () => {
    for (const v of VILLAGES) {
      expect(v.buildings.filter((b) => b.kind === 'hall')).toHaveLength(1);
      for (let i = 0; i < v.buildings.length; i++) {
        const a = v.buildings[i];
        expect(inBounds(a.kind, a.x, a.y), `${v.id} ${a.kind}@${a.x},${a.y}`).toBe(true);
        for (let j = i + 1; j < v.buildings.length; j++) {
          expect(overlaps(a, v.buildings[j]), `${v.id} ${a.kind}@${a.x},${a.y} vs ${v.buildings[j].kind}@${v.buildings[j].x},${v.buildings[j].y}`).toBe(false);
        }
      }
    }
  });

  it('obey the same caps a player of that tier would', () => {
    for (const v of VILLAGES) {
      const counts = new Map<BuildingKind, number>();
      for (const b of v.buildings) {
        counts.set(b.kind, (counts.get(b.kind) ?? 0) + 1);
        expect(b.level, `${v.id} ${b.kind}`).toBeLessThanOrEqual(maxLevel(b.kind, v.tier));
        expect(BUILDINGS[b.kind].unlockHall).toBeLessThanOrEqual(v.tier);
      }
      for (const [kind, n] of counts) expect(n, `${v.id} ${kind}`).toBeLessThanOrEqual(maxCount(kind, v.tier));
    }
  });

  it('unlock one tier ahead of the hall', () => {
    expect(availableVillages(1).map((v) => v.tier)).toEqual([1, 2]);
    expect(availableVillages(5)).toHaveLength(VILLAGES.length);
  });
});
