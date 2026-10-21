import { describe, expect, it } from 'vitest';
import { buy, cancelUpgrade, checkBuy, checkUpgrade, finishWithAsh, settleUpgrades, upgrade } from '../src/game/build';
import { BUILDINGS, SECOND_BUILDER_ASH, levelDef } from '../src/game/data/buildings';
import { canPlaceAt, freeBuilders, hall, newGame } from '../src/game/state';

const T0 = 1_700_000_000_000;

describe('building and upgrading', () => {
  it('a new building uses a builder and finishes on its timer', () => {
    const s = newGame(T0);
    s.resources.wood = 10_000;
    const b = buy(s, 'barracks', 0, 0, T0);
    expect(typeof b).toBe('object');
    expect(freeBuilders(s)).toBe(0);
    const lv = levelDef('barracks', 1);
    expect(s.resources.wood).toBe(10_000 - lv.cost);
    expect(settleUpgrades(s, T0 + lv.time * 1000 - 1)).toHaveLength(0);
    expect(settleUpgrades(s, T0 + lv.time * 1000)).toHaveLength(1);
    expect(freeBuilders(s)).toBe(1);
  });

  it('refuses a second job when the only builder is busy', () => {
    const s = newGame(T0);
    s.resources.wood = 10_000;
    s.resources.stone = 10_000;
    buy(s, 'barracks', 0, 0, T0);
    expect(checkBuy(s, 'archer_post').result).toBe('no_builder');
    expect(checkUpgrade(s, hall(s)).result).toBe('no_builder');
  });

  it('walls are instant, need no builder and are capped by hall level', () => {
    const s = newGame(T0);
    s.resources.stone = 100_000;
    s.resources.wood = 100_000;
    buy(s, 'barracks', 0, 0, T0); // builder busy
    const w = buy(s, 'wall', 5, 0, T0);
    expect(typeof w).toBe('object');
    if (typeof w !== 'object') return;
    expect(w.level).toBe(1);
    expect(upgrade(s, w, T0)).toBe('ok');
    expect(w.level).toBe(2);
    expect(upgrade(s, w, T0)).toBe('hall_cap');
  });

  it('respects count caps per hall level', () => {
    const s = newGame(T0);
    s.resources.wood = 100_000;
    expect(checkBuy(s, 'quarry').result).toBe('count');
  });

  it('hall upgrade raises caps and pays Ash', () => {
    const s = newGame(T0);
    s.resources.stone = 100_000;
    const h = hall(s);
    const ashBefore = s.resources.ash;
    expect(upgrade(s, h, T0)).toBe('ok');
    settleUpgrades(s, T0 + 60_000);
    expect(h.level).toBe(2);
    expect(s.resources.ash).toBe(ashBefore + 50);
    expect(checkBuy(s, 'quarry').result).toBe('ok');
  });

  it('cancelling refunds half and removes unbuilt buildings', () => {
    const s = newGame(T0);
    s.resources.wood = 10_000;
    const b = buy(s, 'barracks', 0, 0, T0);
    if (typeof b !== 'object') throw new Error('buy failed');
    cancelUpgrade(s, b);
    expect(s.buildings.find((o) => o.id === b.id)).toBeUndefined();
    expect(s.resources.wood).toBe(10_000 - levelDef('barracks', 1).cost + Math.floor(levelDef('barracks', 1).cost / 2));
  });

  it('Ash finishes a timer instantly', () => {
    const s = newGame(T0);
    s.resources.wood = 10_000;
    const b = buy(s, 'barracks', 0, 0, T0);
    if (typeof b !== 'object') throw new Error('buy failed');
    expect(finishWithAsh(s, b, T0)).toBe('ok');
    expect(b.level).toBe(1);
    expect(b.upgrade).toBeUndefined();
  });

  it('the second builder costs Ash and adds a builder', () => {
    const s = newGame(T0);
    s.resources.ash = SECOND_BUILDER_ASH;
    const hut = buy(s, 'builder_hut', 0, 0, T0);
    expect(typeof hut).toBe('object');
    expect(s.builders).toBe(2);
    expect(s.resources.ash).toBe(0);
    expect(checkBuy(s, 'builder_hut').result).toBe('count');
  });

  it('placement rejects overlaps and out-of-bounds', () => {
    const s = newGame(T0);
    const h = hall(s);
    expect(canPlaceAt(s, 'quarry', h.x, h.y)).toBe(false);
    expect(canPlaceAt(s, 'quarry', 23, 23)).toBe(false);
    expect(canPlaceAt(s, 'quarry', 0, 0)).toBe(true);
  });

  it('every building has a level table that fits its hall caps', () => {
    for (const def of Object.values(BUILDINGS)) {
      expect(def.levels.length).toBeGreaterThan(0);
      expect(Math.max(...def.maxLevelByHall)).toBeLessThanOrEqual(def.levels.length);
      for (let i = 1; i < def.levels.length; i++) {
        expect(def.levels[i].cost).toBeGreaterThanOrEqual(def.levels[i - 1].cost);
        expect(def.levels[i].time).toBeGreaterThanOrEqual(def.levels[i - 1].time);
      }
    }
  });
});
