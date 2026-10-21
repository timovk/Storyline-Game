import { describe, expect, it } from 'vitest';
import { deserialize, load, save, serialize, timeShift, type Storage } from '../src/game/save';
import { newGame } from '../src/game/state';
import { buy, settleUpgrades } from '../src/game/build';

const T0 = 1_700_000_000_000;

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe('save', () => {
  it('round-trips the state', () => {
    const s = newGame(T0);
    s.resources.wood = 1234;
    const back = deserialize(serialize(s));
    expect(back).toEqual(s);
  });

  it('rejects junk and falls back to a new game', () => {
    expect(deserialize('{"nope":1}')).toBeNull();
    expect(deserialize('not json')).toBeNull();
    const st = memStorage();
    st.setItem('emberhold.save.v1', 'garbage');
    expect(load(st, T0).buildings.length).toBeGreaterThan(0);
  });

  it('persists through storage and records lastSeenAt', () => {
    const st = memStorage();
    const s = newGame(T0);
    save(st, s, T0 + 5);
    const back = load(st, T0 + 10);
    expect(back.lastSeenAt).toBe(T0 + 5);
  });

  it('time shift makes timers finish', () => {
    const s = newGame(T0);
    s.resources.wood = 10_000;
    buy(s, 'barracks', 0, 0, T0);
    timeShift(s, 3_600_000);
    expect(settleUpgrades(s, T0)).toHaveLength(1);
  });
});
