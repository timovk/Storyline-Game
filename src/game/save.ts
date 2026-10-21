import { SAVE_VERSION, newGame } from './state';
import type { GameState } from './types';

export const SAVE_KEY = 'emberhold.save.v1';

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState | null {
  try {
    const parsed = JSON.parse(json) as Partial<GameState>;
    if (!parsed || parsed.version !== SAVE_VERSION || !Array.isArray(parsed.buildings)) return null;
    return parsed as GameState;
  } catch {
    return null;
  }
}

export function load(storage: Storage, now: number): GameState {
  const raw = storage.getItem(SAVE_KEY);
  const state = raw ? deserialize(raw) : null;
  return state ?? newGame(now);
}

export function save(storage: Storage, state: GameState, now: number): void {
  state.lastSeenAt = now;
  storage.setItem(SAVE_KEY, serialize(state));
}

export function wipe(storage: Storage): void {
  storage.removeItem(SAVE_KEY);
}

/** Developer helper: shifts every timestamp back so that `ms` of game time appears to have passed. */
export function timeShift(state: GameState, ms: number): void {
  for (const b of state.buildings) {
    if (b.lastCollectAt !== undefined) b.lastCollectAt -= ms;
    if (b.upgrade) {
      b.upgrade.startedAt -= ms;
      b.upgrade.finishAt -= ms;
    }
  }
  if (state.army.trainingStartedAt !== undefined) state.army.trainingStartedAt -= ms;
  if (state.shieldUntil > 0) state.shieldUntil -= ms;
  state.lastSeenAt -= ms;
}
