import { describe, expect, it } from 'vitest';
import { canTrain, dequeue, housingUsed, settleTraining, train, trainTimeMs } from '../src/game/army';
import { addBuilding, newGame, troopCapacity } from '../src/game/state';
import { TROOPS } from '../src/game/data/troops';

const T0 = 1_700_000_000_000;

function withBarracks(level = 1) {
  const s = newGame(T0);
  addBuilding(s, 'barracks', level, 0, 0, T0);
  s.resources.wood = 10_000;
  return s;
}

describe('army', () => {
  it('needs a barracks and the right hall level', () => {
    const s = newGame(T0);
    s.resources.wood = 1000;
    expect(canTrain(s, 'militia')).toBe('no_barracks');
    const t = withBarracks();
    expect(canTrain(t, 'slinger')).toBe('locked');
    expect(canTrain(t, 'militia')).toBe('ok');
  });

  it('trains sequentially from timestamps', () => {
    const s = withBarracks();
    train(s, 'militia', T0, 3);
    expect(housingUsed(s)).toBe(3);
    const each = trainTimeMs(s, 'militia');
    settleTraining(s, T0 + each * 2 + 1);
    expect(s.army.troops.militia).toBe(2);
    expect(s.army.queue[0].count).toBe(1);
    settleTraining(s, T0 + each * 10);
    expect(s.army.troops.militia).toBe(3);
    expect(s.army.queue).toHaveLength(0);
    expect(s.army.trainingStartedAt).toBeUndefined();
  });

  it('respects housing', () => {
    const s = withBarracks();
    const cap = troopCapacity(s);
    expect(train(s, 'militia', T0, cap)).toBe('ok');
    expect(train(s, 'militia', T0)).toBe('housing');
  });

  it('dequeueing refunds the troop', () => {
    const s = withBarracks();
    const wood = s.resources.wood;
    train(s, 'militia', T0, 2);
    expect(dequeue(s, 'militia', T0)).toBe(true);
    expect(s.resources.wood).toBe(wood - TROOPS.militia.cost);
    expect(housingUsed(s)).toBe(1);
  });
});
