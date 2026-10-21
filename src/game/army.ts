import { TROOPS } from './data/troops';
import { spend } from './economy';
import { countOf, hallLevel, troopCapacity } from './state';
import type { GameState, TroopKind } from './types';

export function housingUsed(state: GameState): number {
  let used = 0;
  for (const k of Object.keys(state.army.troops) as TroopKind[]) used += state.army.troops[k] * TROOPS[k].housing;
  for (const job of state.army.queue) used += job.count * TROOPS[job.kind].housing;
  return used;
}

export function canTrain(state: GameState, kind: TroopKind, count = 1): 'ok' | 'locked' | 'no_barracks' | 'housing' | 'resources' {
  const def = TROOPS[kind];
  if (hallLevel(state) < def.unlockHall) return 'locked';
  if (countOf(state, 'barracks') === 0) return 'no_barracks';
  if (housingUsed(state) + def.housing * count > troopCapacity(state)) return 'housing';
  if (state.resources.wood < def.cost * count) return 'resources';
  return 'ok';
}

export function train(state: GameState, kind: TroopKind, now: number, count = 1): ReturnType<typeof canTrain> {
  const r = canTrain(state, kind, count);
  if (r !== 'ok') return r;
  spend(state, 'wood', TROOPS[kind].cost * count);
  const last = state.army.queue[state.army.queue.length - 1];
  if (last && last.kind === kind) last.count += count;
  else state.army.queue.push({ kind, count });
  if (state.army.trainingStartedAt === undefined) state.army.trainingStartedAt = now;
  return 'ok';
}

/** Effective training time for one troop, given how many barracks share the work. */
export function trainTimeMs(state: GameState, kind: TroopKind): number {
  const barracks = Math.max(1, countOf(state, 'barracks'));
  return (TROOPS[kind].trainTime * 1000) / barracks;
}

/** Moves finished troops out of the queue. Timestamps drive it so it works offline too. */
export function settleTraining(state: GameState, now: number): void {
  const army = state.army;
  if (army.queue.length === 0 || army.trainingStartedAt === undefined) {
    army.trainingStartedAt = undefined;
    return;
  }
  let t = army.trainingStartedAt;
  while (army.queue.length > 0) {
    const head = army.queue[0];
    const each = trainTimeMs(state, head.kind);
    if (t + each > now) break;
    t += each;
    head.count -= 1;
    army.troops[head.kind] += 1;
    if (head.count <= 0) army.queue.shift();
  }
  army.trainingStartedAt = army.queue.length > 0 ? t : undefined;
}

export function dequeue(state: GameState, kind: TroopKind, now: number): boolean {
  settleTraining(state, now);
  for (let i = state.army.queue.length - 1; i >= 0; i--) {
    const job = state.army.queue[i];
    if (job.kind !== kind) continue;
    job.count -= 1;
    state.resources.wood += TROOPS[kind].cost;
    if (job.count <= 0) state.army.queue.splice(i, 1);
    if (i === 0) state.army.trainingStartedAt = state.army.queue.length > 0 ? now : undefined;
    return true;
  }
  return false;
}

/** Progress (0..1) of the troop currently training, for the UI. */
export function trainingProgress(state: GameState, now: number): number {
  const head = state.army.queue[0];
  if (!head || state.army.trainingStartedAt === undefined) return 0;
  return Math.min(1, (now - state.army.trainingStartedAt) / trainTimeMs(state, head.kind));
}
