// 4-directional A* over the village grid. Walls are passable at a cost that
// reflects how long the unit would need to chew through them, so troops walk
// around walls when a gap exists and break through when that is cheaper.

export interface Tile {
  x: number;
  y: number;
}

export interface PathQuery {
  grid: number;
  start: Tile;
  /** Cost of entering a tile; Infinity for impassable. */
  stepCost: (x: number, y: number) => number;
  /** Whether a tile satisfies the goal (e.g. within range of the target). */
  isGoal: (x: number, y: number) => boolean;
  /** Admissible estimate of remaining distance from a tile. */
  heuristic: (x: number, y: number) => number;
}

/** Returns the path from start (exclusive) to a goal tile (inclusive), or null if none. */
export function findPath(q: PathQuery): Tile[] | null {
  const n = q.grid;
  const size = n * n;
  const g = new Float64Array(size).fill(Infinity);
  const f = new Float64Array(size).fill(Infinity);
  const from = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const idx = (x: number, y: number) => y * n + x;

  const startI = idx(q.start.x, q.start.y);
  if (q.isGoal(q.start.x, q.start.y)) return [];
  g[startI] = 0;
  f[startI] = q.heuristic(q.start.x, q.start.y);

  // Binary heap keyed on f.
  const heap: number[] = [startI];
  const push = (i: number) => {
    heap.push(i);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (f[heap[p]] <= f[heap[c]]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let p = 0;
      for (;;) {
        const l = 2 * p + 1;
        const r = l + 1;
        let m = p;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === p) break;
        [heap[p], heap[m]] = [heap[m], heap[p]];
        p = m;
      }
    }
    return top;
  };

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (heap.length > 0) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % n;
    const cy = (cur - cx) / n;
    if (q.isGoal(cx, cy)) {
      const path: Tile[] = [];
      let i = cur;
      while (i !== startI) {
        path.push({ x: i % n, y: Math.floor(i / n) });
        i = from[i];
      }
      path.reverse();
      return path;
    }
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const ni = idx(nx, ny);
      if (closed[ni]) continue;
      const c = q.stepCost(nx, ny);
      if (!isFinite(c)) continue;
      const ng = g[cur] + c;
      if (ng < g[ni]) {
        g[ni] = ng;
        f[ni] = ng + q.heuristic(nx, ny);
        from[ni] = cur;
        push(ni);
      }
    }
  }
  return null;
}
