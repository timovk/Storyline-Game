// Core types shared by the simulation, persistence and UI layers.

export type Resource = 'wood' | 'stone';

export type BuildingKind =
  | 'hall'
  | 'quarry'
  | 'lumber'
  | 'stone_store'
  | 'wood_store'
  | 'barracks'
  | 'archer_post'
  | 'wall'
  | 'builder_hut';

export type BuildingCategory = 'hall' | 'resource' | 'storage' | 'army' | 'defense' | 'wall' | 'utility';

export type TroopKind = 'militia' | 'slinger' | 'goat_rider';

export interface LevelDef {
  /** Cost in the building's cost resource. */
  cost: number;
  /** Build/upgrade time in seconds. 0 means instant (walls). */
  time: number;
  hp: number;
  /** Resource production per hour (collectors). */
  prod?: number;
  /** Internal collector capacity before it stops producing. */
  collectorCap?: number;
  /** Storage contributed to the village for the building's resource (or both for the hall). */
  storage?: number;
  /** Defense damage per second. */
  dps?: number;
  /** Defense range in tiles, measured from the building centre. */
  range?: number;
  /** Troop housing contributed (barracks). */
  housing?: number;
}

export interface BuildingDef {
  kind: BuildingKind;
  name: string;
  category: BuildingCategory;
  size: number;
  /** Resource the building is paid for in. */
  costResource: Resource;
  /** Resource the building produces or stores, where relevant. */
  resource?: Resource;
  unlockHall: number;
  levels: LevelDef[];
  /** Max number of this building allowed at each hall level (index 0 = hall 1). */
  maxCountByHall: number[];
  /** Max level for this building at each hall level (index 0 = hall 1). */
  maxLevelByHall: number[];
  /** Whether the building needs a builder to upgrade. Walls do not. */
  needsBuilder: boolean;
  description: string;
}

export interface TroopDef {
  kind: TroopKind;
  name: string;
  unlockHall: number;
  housing: number;
  cost: number; // wood
  trainTime: number; // seconds
  hp: number;
  damage: number;
  hitEvery: number; // seconds
  speed: number; // tiles per second
  range: number; // tiles; <= 1 means melee
  prefers: 'any' | 'defense';
  description: string;
}

export interface UpgradeJob {
  toLevel: number;
  startedAt: number;
  finishAt: number;
}

export interface Building {
  id: number;
  kind: BuildingKind;
  level: number;
  x: number;
  y: number;
  upgrade?: UpgradeJob;
  /** Collectors: timestamp from which pending production is computed. */
  lastCollectAt?: number;
}

export interface TrainingJob {
  kind: TroopKind;
  count: number;
}

export interface ArmyState {
  troops: Record<TroopKind, number>;
  queue: TrainingJob[];
  /** Timestamp at which the head of the queue began training. */
  trainingStartedAt?: number;
}

export interface RaidReport {
  at: number;
  villageId: string;
  villageName: string;
  direction: 'attack' | 'defense';
  stars: number;
  destruction: number; // 0..1
  loot: { wood: number; stone: number };
  ashEarned: number;
  troopsLost: number;
}

export interface GameState {
  version: number;
  createdAt: number;
  lastSeenAt: number;
  resources: { wood: number; stone: number; ash: number };
  builders: number;
  nextId: number;
  buildings: Building[];
  army: ArmyState;
  /** Best star count achieved per AI village, used for one-time Ash rewards. */
  villageStars: Record<string, number>;
  raidLog: RaidReport[];
  shieldUntil: number;
  /** Lifetime stats for the player to look at. */
  stats: { raids: number; starsTotal: number; lootWood: number; lootStone: number };
}

export const GRID = 24;
