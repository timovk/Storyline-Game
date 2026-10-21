import type { Building, BuildingKind } from '../types';

export interface AiVillage {
  id: string;
  name: string;
  tier: number;
  blurb: string;
  loot: { wood: number; stone: number };
  buildings: Building[];
}

interface Spec {
  kind: BuildingKind;
  level: number;
  x: number;
  y: number;
}

function b(kind: BuildingKind, level: number, x: number, y: number): Spec {
  return { kind, level, x, y };
}

/** Hollow rectangle of wall segments from (x0,y0) to (x1,y1) inclusive. */
function ring(x0: number, y0: number, x1: number, y1: number, level: number, gaps: Array<[number, number]> = []): Spec[] {
  const out: Spec[] = [];
  const isGap = (x: number, y: number) => gaps.some(([gx, gy]) => gx === x && gy === y);
  for (let x = x0; x <= x1; x++) {
    if (!isGap(x, y0)) out.push(b('wall', level, x, y0));
    if (y1 !== y0 && !isGap(x, y1)) out.push(b('wall', level, x, y1));
  }
  for (let y = y0 + 1; y < y1; y++) {
    if (!isGap(x0, y)) out.push(b('wall', level, x0, y));
    if (x1 !== x0 && !isGap(x1, y)) out.push(b('wall', level, x1, y));
  }
  return out;
}

function village(id: string, name: string, tier: number, blurb: string, loot: { wood: number; stone: number }, specs: Spec[]): AiVillage {
  const buildings: Building[] = specs.map((s, i) => ({ id: i + 1, kind: s.kind, level: s.level, x: s.x, y: s.y }));
  return { id, name, tier, blurb, loot, buildings };
}

export const VILLAGES: AiVillage[] = [
  village('mudflats', 'Mudflats Camp', 1, 'A handful of tents by the river. Barely defended.', { wood: 350, stone: 350 }, [
    b('hall', 1, 10, 10),
    b('quarry', 1, 6, 10),
    b('lumber', 1, 14, 10),
    b('archer_post', 1, 11, 6),
    b('barracks', 1, 10, 14),
  ]),
  village('fernhollow', 'Fernhollow', 2, 'A farming hamlet that has just learned what walls are for.', { wood: 1400, stone: 1400 }, [
    b('hall', 2, 10, 10),
    ...ring(8, 8, 14, 14, 2, [[11, 14]]),
    b('quarry', 2, 4, 9),
    b('quarry', 2, 4, 13),
    b('lumber', 2, 17, 9),
    b('lumber', 2, 17, 13),
    b('stone_store', 2, 9, 4),
    b('wood_store', 2, 12, 4),
    b('archer_post', 3, 6, 6),
    b('archer_post', 3, 15, 6),
    b('barracks', 2, 9, 17),
  ]),
  village('greywatch', 'Greywatch', 3, 'A stone outpost with three archer posts covering every approach.', { wood: 4500, stone: 4500 }, [
    b('hall', 3, 10, 10),
    b('archer_post', 5, 7, 7),
    b('archer_post', 5, 14, 7),
    b('archer_post', 5, 10, 14),
    ...ring(6, 6, 16, 16, 3),
    b('quarry', 4, 2, 6),
    b('quarry', 4, 2, 10),
    b('quarry', 4, 2, 14),
    b('lumber', 4, 19, 6),
    b('lumber', 4, 19, 10),
    b('lumber', 4, 19, 14),
    b('stone_store', 4, 8, 2),
    b('wood_store', 4, 13, 2),
    b('stone_store', 4, 8, 19),
    b('wood_store', 4, 13, 19),
    b('barracks', 4, 18, 18),
  ]),
  village('thornkeep', 'Thornkeep', 4, 'Two rings of wall and four posts. The storehouses are in the inner ward.', { wood: 13000, stone: 13000 }, [
    b('hall', 4, 10, 10),
    ...ring(8, 8, 14, 14, 5),
    b('stone_store', 6, 5, 5),
    b('wood_store', 6, 16, 5),
    b('stone_store', 6, 5, 16),
    b('wood_store', 6, 16, 16),
    b('archer_post', 7, 11, 5),
    b('archer_post', 7, 11, 16),
    b('archer_post', 7, 5, 11),
    b('archer_post', 7, 16, 11),
    ...ring(3, 3, 19, 19, 4, [[11, 3], [11, 19]]),
    b('quarry', 6, 0, 0),
    b('quarry', 6, 21, 0),
    b('quarry', 6, 0, 21),
    b('quarry', 6, 21, 21),
    b('lumber', 6, 0, 8),
    b('lumber', 6, 0, 13),
    b('lumber', 6, 21, 8),
    b('lumber', 6, 21, 13),
    b('barracks', 6, 10, 0),
    b('barracks', 6, 10, 20),
  ]),
  village('brackenhold', 'Brackenhold', 5, 'A proper fortress. Five posts, double walls, and a very fat treasury.', { wood: 32000, stone: 32000 }, [
    b('hall', 5, 10, 10),
    ...ring(8, 8, 14, 14, 7),
    b('archer_post', 9, 11, 5),
    b('archer_post', 9, 11, 16),
    b('archer_post', 9, 5, 11),
    b('archer_post', 9, 16, 11),
    ...ring(3, 3, 19, 19, 6),
    b('stone_store', 8, 5, 5),
    b('wood_store', 8, 16, 5),
    b('stone_store', 8, 5, 16),
    b('wood_store', 8, 16, 16),
    b('archer_post', 9, 11, 21),
    b('stone_store', 8, 1, 10),
    b('wood_store', 8, 21, 10),
    b('quarry', 8, 0, 0),
    b('quarry', 8, 21, 0),
    b('quarry', 8, 0, 21),
    b('quarry', 8, 21, 21),
    b('quarry', 8, 5, 0),
    b('lumber', 8, 15, 0),
    b('lumber', 8, 0, 5),
    b('lumber', 8, 21, 5),
    b('lumber', 8, 0, 15),
    b('lumber', 8, 21, 15),
    b('barracks', 8, 9, 0),
    b('barracks', 8, 0, 18),
    b('barracks', 8, 20, 18),
  ]),
];

export function villageById(id: string): AiVillage | undefined {
  return VILLAGES.find((v) => v.id === id);
}

/** Villages a player of this hall level is allowed to scout. */
export function availableVillages(hallLevel: number): AiVillage[] {
  return VILLAGES.filter((v) => v.tier <= hallLevel + 1);
}
