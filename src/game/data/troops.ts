import type { TroopDef, TroopKind } from '../types';

export const TROOPS: Record<TroopKind, TroopDef> = {
  militia: {
    kind: 'militia',
    name: 'Militia',
    unlockHall: 1,
    housing: 1,
    cost: 25,
    trainTime: 15,
    hp: 60,
    damage: 10,
    hitEvery: 1,
    speed: 2,
    range: 0.8,
    prefers: 'any',
    description: 'Farmers with pitchforks. Cheap, numerous, and they hit whatever is closest.',
  },
  slinger: {
    kind: 'slinger',
    name: 'Slinger',
    unlockHall: 2,
    housing: 1,
    cost: 50,
    trainTime: 25,
    hp: 30,
    damage: 12,
    hitEvery: 1.2,
    speed: 2.2,
    range: 3.5,
    prefers: 'any',
    description: 'Fragile, but throws stones over walls from a distance.',
  },
  goat_rider: {
    kind: 'goat_rider',
    name: 'Goat Rider',
    unlockHall: 3,
    housing: 3,
    cost: 180,
    trainTime: 60,
    hp: 150,
    damage: 20,
    hitEvery: 0.8,
    speed: 4,
    range: 0.8,
    prefers: 'defense',
    description: 'Fast mountain cavalry. Goes straight for the Archer Posts.',
  },
};

export const TROOP_ORDER: TroopKind[] = ['militia', 'slinger', 'goat_rider'];

/** Attack duration in seconds, measured from the first deployment. */
export const BATTLE_SECONDS = 180;
