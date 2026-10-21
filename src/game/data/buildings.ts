import type { BuildingDef, BuildingKind, LevelDef, Resource } from '../types';

const COST_GROWTH = 1.65;
const TIME_GROWTH = 1.8;

function round(n: number): number {
  if (n < 100) return Math.round(n / 5) * 5;
  if (n < 1000) return Math.round(n / 10) * 10;
  if (n < 10000) return Math.round(n / 50) * 50;
  return Math.round(n / 100) * 100;
}

function roundTime(s: number): number {
  if (s < 60) return Math.round(s / 5) * 5;
  if (s < 3600) return Math.round(s / 30) * 30;
  return Math.round(s / 300) * 300;
}

/** Generates a level table from base values using the curve described in the concept doc. */
function curve(
  count: number,
  baseCost: number,
  baseTime: number,
  extra: (level: number) => Partial<LevelDef>,
): LevelDef[] {
  const out: LevelDef[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      cost: round(baseCost * Math.pow(COST_GROWTH, i)),
      time: roundTime(baseTime * Math.pow(TIME_GROWTH, i)),
      hp: 100,
      ...extra(i + 1),
    });
  }
  return out;
}

const MAX_LEVEL_BY_HALL = [2, 4, 6, 8, 10];

function collector(kind: 'quarry' | 'lumber', name: string, produces: Resource, costResource: Resource, description: string): BuildingDef {
  return {
    kind,
    name,
    category: 'resource',
    size: 2,
    costResource,
    resource: produces,
    unlockHall: 1,
    needsBuilder: true,
    description,
    levels: curve(10, 150, 30, (lvl) => {
      const prod = round(200 * Math.pow(1.32, lvl - 1));
      return { prod, collectorCap: prod * 8, hp: round(250 * Math.pow(1.18, lvl - 1)) };
    }),
    maxCountByHall: [1, 2, 3, 4, 5],
    maxLevelByHall: MAX_LEVEL_BY_HALL,
  };
}

function store(kind: 'stone_store' | 'wood_store', name: string, stores: Resource, costResource: Resource): BuildingDef {
  return {
    kind,
    name,
    category: 'storage',
    size: 2,
    costResource,
    resource: stores,
    unlockHall: 1,
    needsBuilder: true,
    description: `Raises how much ${stores} the village can hold. Raiders can only take a slice of what is stored here.`,
    levels: curve(10, 300, 60, (lvl) => ({
      storage: round(2000 * Math.pow(1.7, lvl - 1)),
      hp: round(600 * Math.pow(1.2, lvl - 1)),
    })),
    maxCountByHall: [1, 1, 2, 2, 3],
    maxLevelByHall: MAX_LEVEL_BY_HALL,
  };
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  hall: {
    kind: 'hall',
    name: 'Ember Hall',
    category: 'hall',
    size: 3,
    costResource: 'stone',
    unlockHall: 1,
    needsBuilder: true,
    description: 'The heart of the village. Its level decides what you can build and how high everything can go.',
    levels: [
      { cost: 0, time: 0, hp: 1200, storage: 1000 },
      { cost: 500, time: 10, hp: 1600, storage: 2500 },
      { cost: 4000, time: 15 * 60, hp: 2100, storage: 5000 },
      { cost: 25000, time: 2 * 3600, hp: 2800, storage: 10000 },
      { cost: 150000, time: 8 * 3600, hp: 3600, storage: 20000 },
    ],
    maxCountByHall: [1, 1, 1, 1, 1],
    maxLevelByHall: [2, 3, 4, 5, 5],
  },
  quarry: collector('quarry', 'Quarry', 'stone', 'wood', 'Cuts stone out of the valley wall. Tap it to collect what it has gathered.'),
  lumber: collector('lumber', 'Lumber Camp', 'wood', 'stone', 'Fells the pines on the ridge. Tap it to collect what it has gathered.'),
  stone_store: store('stone_store', 'Stone Store', 'stone', 'wood'),
  wood_store: store('wood_store', 'Wood Store', 'wood', 'stone'),
  barracks: {
    kind: 'barracks',
    name: 'Barracks',
    category: 'army',
    size: 3,
    costResource: 'wood',
    unlockHall: 1,
    needsBuilder: true,
    description: 'Trains and houses your troops. More barracks train faster and hold more.',
    levels: curve(10, 200, 60, (lvl) => ({
      housing: 8 + 4 * (lvl - 1),
      hp: round(500 * Math.pow(1.15, lvl - 1)),
    })),
    maxCountByHall: [1, 1, 2, 2, 3],
    maxLevelByHall: MAX_LEVEL_BY_HALL,
  },
  archer_post: {
    kind: 'archer_post',
    name: 'Archer Post',
    category: 'defense',
    size: 2,
    costResource: 'stone',
    unlockHall: 1,
    needsBuilder: true,
    description: 'A raised platform with a pair of archers. Shoots the nearest raider in range.',
    levels: curve(10, 400, 60, (lvl) => ({
      dps: round(9 * Math.pow(1.18, lvl - 1)),
      range: 6,
      hp: round(320 * Math.pow(1.2, lvl - 1)),
    })),
    maxCountByHall: [1, 2, 3, 4, 5],
    maxLevelByHall: MAX_LEVEL_BY_HALL,
  },
  wall: {
    kind: 'wall',
    name: 'Wall',
    category: 'wall',
    size: 1,
    costResource: 'stone',
    unlockHall: 1,
    needsBuilder: false,
    description: 'Slows raiders down. Each segment is upgraded on its own and upgrades are instant.',
    levels: [
      { cost: 50, time: 0, hp: 300 },
      { cost: 150, time: 0, hp: 500 },
      { cost: 400, time: 0, hp: 800 },
      { cost: 1000, time: 0, hp: 1300 },
      { cost: 2500, time: 0, hp: 2000 },
      { cost: 5000, time: 0, hp: 3000 },
      { cost: 10000, time: 0, hp: 4500 },
      { cost: 20000, time: 0, hp: 6500 },
      { cost: 40000, time: 0, hp: 9000 },
      { cost: 75000, time: 0, hp: 12000 },
    ],
    maxCountByHall: [25, 50, 75, 100, 125],
    maxLevelByHall: MAX_LEVEL_BY_HALL,
  },
  builder_hut: {
    kind: 'builder_hut',
    name: "Builder's Hut",
    category: 'utility',
    size: 2,
    costResource: 'wood',
    unlockHall: 1,
    needsBuilder: false,
    description: 'Home to one builder. A second hut means two jobs at once.',
    levels: [{ cost: 0, time: 0, hp: 250 }],
    maxCountByHall: [2, 2, 2, 2, 2],
    maxLevelByHall: [1, 1, 1, 1, 1],
  },
};

/** Ash price for the second builder. */
export const SECOND_BUILDER_ASH = 250;

/** Order in which the shop lists buildings. */
export const SHOP_ORDER: BuildingKind[] = [
  'quarry',
  'lumber',
  'stone_store',
  'wood_store',
  'barracks',
  'archer_post',
  'wall',
  'builder_hut',
];

export function levelDef(kind: BuildingKind, level: number): LevelDef {
  const def = BUILDINGS[kind];
  return def.levels[Math.min(level, def.levels.length) - 1];
}

export function maxLevel(kind: BuildingKind, hallLevel: number): number {
  const def = BUILDINGS[kind];
  return Math.min(def.levels.length, def.maxLevelByHall[Math.min(hallLevel, def.maxLevelByHall.length) - 1]);
}

export function maxCount(kind: BuildingKind, hallLevel: number): number {
  const def = BUILDINGS[kind];
  return def.maxCountByHall[Math.min(hallLevel, def.maxCountByHall.length) - 1];
}
