import { describe, expect, it } from 'vitest';
import { canDeploy, createBattle, deploy, destruction, runToEnd, stars, step } from '../src/game/battle/sim';
import { findPath } from '../src/game/battle/pathfinding';
import { VILLAGES, villageById } from '../src/game/data/villages';
import { aiLootTable, applyRaidResult, counterRaidArmy, maybeCounterRaid, startRaid } from '../src/game/raid';
import { newGame, addBuilding } from '../src/game/state';
import { GRID, type TroopKind } from '../src/game/types';

const T0 = 1_700_000_000_000;

function battleFor(id: string, army: Record<TroopKind, number>, seed = 1) {
  const v = villageById(id)!;
  return createBattle({ grid: GRID, buildings: v.buildings, lootOf: aiLootTable(v), army, seed });
}

describe('pathfinding', () => {
  it('walks around an obstacle', () => {
    const blocked = new Set(['1,0', '1,1', '1,2']);
    const path = findPath({
      grid: 5,
      start: { x: 0, y: 0 },
      stepCost: (x, y) => (blocked.has(`${x},${y}`) ? Infinity : 1),
      isGoal: (x, y) => x === 2 && y === 0,
      heuristic: (x, y) => Math.abs(x - 2) + Math.abs(y - 0),
    });
    expect(path).not.toBeNull();
    expect(path!.at(-1)).toEqual({ x: 2, y: 0 });
    expect(path!.length).toBe(8);
  });

  it('breaks through when going around costs more', () => {
    const path = findPath({
      grid: 5,
      start: { x: 0, y: 2 },
      stepCost: (x) => (x === 2 ? 3 : 1),
      isGoal: (x, y) => x === 4 && y === 2,
      heuristic: (x) => Math.abs(x - 4),
    });
    expect(path!.length).toBe(4);
  });
});

describe('battle', () => {
  it('only allows deployment outside the village', () => {
    const bs = battleFor('fernhollow', { militia: 5, slinger: 0, goat_rider: 0 });
    expect(canDeploy(bs, 'militia', 0, 0)).toBe(true);
    expect(canDeploy(bs, 'militia', 11, 11)).toBe(false); // inside the wall ring
    expect(canDeploy(bs, 'militia', 10, 10)).toBe(false); // on the hall
    expect(canDeploy(bs, 'slinger', 0, 0)).toBe(false); // none in the army
  });

  it('a big enough army levels the first village and takes its loot', () => {
    const bs = battleFor('mudflats', { militia: 20, slinger: 0, goat_rider: 0 });
    for (let i = 0; i < 20; i++) deploy(bs, 'militia', i % 2 === 0 ? 0 : 23, (i * 3) % 24);
    runToEnd(bs);
    expect(bs.endReason).toBe('destroyed');
    expect(destruction(bs)).toBe(1);
    expect(stars(bs)).toBe(3);
    expect(bs.loot.wood).toBe(350 - (350 % 3));
  });

  it('a lone militia dies to the archers and the battle ends', () => {
    const bs = battleFor('greywatch', { militia: 1, slinger: 0, goat_rider: 0 });
    deploy(bs, 'militia', 0, 0);
    runToEnd(bs);
    expect(bs.endReason).toBe('army_spent');
    expect(bs.units[0].alive).toBe(false);
    expect(stars(bs)).toBe(0);
  });

  it('troops get through a closed wall ring', () => {
    const bs = battleFor('greywatch', { militia: 40, slinger: 0, goat_rider: 0 });
    for (let i = 0; i < 40; i++) deploy(bs, 'militia', 0, i % 24);
    runToEnd(bs);
    expect(bs.buildings.filter((b) => b.kind === 'wall' && !b.alive).length).toBeGreaterThan(0);
    expect(destruction(bs)).toBeGreaterThan(0.3);
  });

  it('goat riders go for the archer posts first', () => {
    const bs = battleFor('fernhollow', { militia: 0, slinger: 0, goat_rider: 1 });
    deploy(bs, 'goat_rider', 6, 0);
    step(bs);
    const target = bs.buildings.find((b) => b.id === bs.units[0].targetId)!;
    expect(target.kind).toBe('archer_post');
  });

  it('is deterministic for a given seed', () => {
    const run = () => {
      const bs = battleFor('fernhollow', { militia: 15, slinger: 5, goat_rider: 0 }, 42);
      for (let i = 0; i < 15; i++) deploy(bs, 'militia', 0, i);
      for (let i = 0; i < 5; i++) deploy(bs, 'slinger', 1, i);
      runToEnd(bs);
      return [bs.t, bs.loot.wood, destruction(bs)];
    };
    expect(run()).toEqual(run());
  });

  it('every village can be fully destroyed by a maxed army of its tier', () => {
    for (const v of VILLAGES) {
      const army = { militia: 20 + v.tier * 20, slinger: v.tier >= 2 ? 10 * v.tier : 0, goat_rider: v.tier >= 3 ? 4 * v.tier : 0 };
      const bs = createBattle({ grid: GRID, buildings: v.buildings, lootOf: aiLootTable(v), army, seed: 7 });
      let n = 0;
      for (const kind of ['goat_rider', 'militia', 'slinger'] as TroopKind[]) {
        for (let i = 0; i < army[kind]; i++) {
          const side = n % 4;
          const k = Math.floor(n / 4) % 24;
          const [x, y] = side === 0 ? [0, k] : side === 1 ? [23, k] : side === 2 ? [k, 0] : [k, 23];
          deploy(bs, kind, x, y);
          n++;
        }
      }
      runToEnd(bs);
      expect(destruction(bs), v.id).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe('raid glue', () => {
  it('applies loot, spends troops and pays Ash once per new star', () => {
    const s = newGame(T0);
    addBuilding(s, 'barracks', 10, 0, 0, T0);
    s.army.troops.militia = 20;
    const v = villageById('mudflats')!;
    const bs = startRaid(s, v, 3);
    for (let i = 0; i < 20; i++) deploy(bs, 'militia', i % 2 === 0 ? 0 : 23, (i * 3) % 24);
    runToEnd(bs);
    const ashBefore = s.resources.ash;
    const r = applyRaidResult(s, v, bs, T0);
    expect(r.stars).toBe(3);
    expect(s.resources.ash).toBe(ashBefore + 30);
    expect(s.army.troops.militia).toBe(0);
    expect(s.resources.stone).toBeGreaterThan(600);
    const r2 = applyRaidResult(s, v, bs, T0);
    expect(r2.ashEarned).toBe(0);
  });

  it('counter-raids only after a long absence and grants a shield', () => {
    const s = newGame(T0);
    s.resources.wood = 1000;
    s.resources.stone = 1000;
    expect(maybeCounterRaid(s, T0 + 60_000)).toBeNull();
    const r = maybeCounterRaid(s, T0 + 4 * 3_600_000, 5);
    expect(r).not.toBeNull();
    expect(r!.direction).toBe('defense');
    expect(s.shieldUntil).toBeGreaterThan(T0 + 4 * 3_600_000);
    expect(s.resources.wood + s.resources.stone).toBeLessThan(2000);
    // Only the stored slice (20%) can leave the stockpile; collector loot drains the collectors instead.
    expect(s.resources.wood).toBeGreaterThanOrEqual(800);
    expect(s.resources.stone).toBeGreaterThanOrEqual(800);
    for (const b of s.buildings) if (b.lastCollectAt !== undefined) expect(b.lastCollectAt).toBeGreaterThan(T0);
    expect(maybeCounterRaid(s, T0 + 8 * 3_600_000)).toBeNull();
  });

  it('counter-raid armies grow with hall level', () => {
    expect(counterRaidArmy(1).goat_rider).toBe(0);
    expect(counterRaidArmy(5).militia).toBeGreaterThan(counterRaidArmy(1).militia);
  });
});
