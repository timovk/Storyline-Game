import { BUILDINGS } from '../game/data/buildings';
import { pendingProduction } from '../game/economy';
import type { Building, BuildingKind, TroopKind } from '../game/types';
import { GRID } from '../game/types';
import type { BattleState } from '../game/battle/sim';

export const KIND_COLORS: Record<BuildingKind, string> = {
  hall: '#d9772f',
  quarry: '#8d9aa6',
  lumber: '#9c6b3c',
  stone_store: '#6f7f8f',
  wood_store: '#7a5230',
  barracks: '#b3443f',
  archer_post: '#5f8f4f',
  wall: '#5a5149',
  builder_hut: '#b89a5a',
};

export const KIND_SHORT: Record<BuildingKind, string> = {
  hall: 'HALL',
  quarry: 'Q',
  lumber: 'L',
  stone_store: 'SS',
  wood_store: 'WS',
  barracks: 'B',
  archer_post: 'A',
  wall: '',
  builder_hut: 'H',
};

export const TROOP_COLORS: Record<TroopKind, string> = {
  militia: '#f2d16b',
  slinger: '#7ad0f2',
  goat_rider: '#f28f7a',
};

export interface Ghost {
  kind: BuildingKind;
  x: number;
  y: number;
  ok: boolean;
}

export interface RenderOptions {
  buildings: Building[];
  now: number;
  selectedId?: number;
  ghost?: Ghost;
  battle?: BattleState;
  deployKind?: TroopKind;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private tile = 10;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const parent = this.canvas.parentElement!;
    const size = Math.floor(Math.min(parent.clientWidth, parent.clientHeight));
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.canvas.width = Math.floor(size * dpr);
    this.canvas.height = Math.floor(size * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.tile = size / GRID;
  }

  /** Converts a pointer event into a tile coordinate. */
  tileAt(ev: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - r.left) / r.width) * GRID);
    const y = Math.floor(((ev.clientY - r.top) / r.height) * GRID);
    return { x: Math.max(0, Math.min(GRID - 1, x)), y: Math.max(0, Math.min(GRID - 1, y)) };
  }

  draw(o: RenderOptions): void {
    const { ctx, tile } = this;
    const size = tile * GRID;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = o.battle ? '#3a4a2c' : '#415a2e';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * tile, 0);
      ctx.lineTo(i * tile, size);
      ctx.moveTo(0, i * tile);
      ctx.lineTo(size, i * tile);
      ctx.stroke();
    }

    if (o.battle && o.deployKind) {
      ctx.fillStyle = 'rgba(244, 184, 96, 0.18)';
      for (let y = 0; y < GRID; y++)
        for (let x = 0; x < GRID; x++) if (o.battle.deployable[y * GRID + x]) ctx.fillRect(x * tile, y * tile, tile, tile);
    }

    const hpOf = new Map<number, { hp: number; maxHp: number; alive: boolean }>();
    if (o.battle) for (const b of o.battle.buildings) hpOf.set(b.id, b);

    for (const b of o.buildings) {
      const bb = hpOf.get(b.id);
      if (o.battle && !bb) continue;
      this.drawBuilding(b, o, bb);
    }

    if (o.ghost) {
      const g = o.ghost;
      const s = BUILDINGS[g.kind].size;
      ctx.fillStyle = g.ok ? 'rgba(124, 198, 107, 0.5)' : 'rgba(224, 100, 100, 0.5)';
      ctx.fillRect(g.x * tile, g.y * tile, s * tile, s * tile);
    }

    if (o.battle) {
      for (const u of o.battle.units) {
        if (!u.alive) continue;
        ctx.beginPath();
        ctx.fillStyle = TROOP_COLORS[u.kind];
        ctx.arc(u.x * tile, u.y * tile, tile * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
        if (u.hp < u.maxHp) {
          ctx.fillStyle = '#000';
          ctx.fillRect(u.x * tile - tile * 0.4, u.y * tile - tile * 0.55, tile * 0.8, 2);
          ctx.fillStyle = '#7cc66b';
          ctx.fillRect(u.x * tile - tile * 0.4, u.y * tile - tile * 0.55, tile * 0.8 * (u.hp / u.maxHp), 2);
        }
      }
    }
  }

  private drawBuilding(b: Building, o: RenderOptions, bb?: { hp: number; maxHp: number; alive: boolean }): void {
    const { ctx, tile } = this;
    const def = BUILDINGS[b.kind];
    const s = def.size;
    const px = b.x * tile;
    const py = b.y * tile;
    const w = s * tile;
    const pad = b.kind === 'wall' ? tile * 0.1 : tile * 0.12;
    const alive = bb ? bb.alive : true;

    ctx.fillStyle = alive ? KIND_COLORS[b.kind] : '#2a2320';
    if (b.kind === 'wall') {
      ctx.fillStyle = alive ? `hsl(30, 8%, ${28 + b.level * 3}%)` : '#2a2320';
      ctx.fillRect(px + pad, py + pad, tile - pad * 2, tile - pad * 2);
      if (alive && b.level >= 5) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(px + pad, py + pad, tile - pad * 2, 2);
      }
    } else {
      roundRect(ctx, px + pad, py + pad, w - pad * 2, w - pad * 2, tile * 0.3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (alive) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.font = `bold ${Math.max(9, tile * 0.75)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(KIND_SHORT[b.kind], px + w / 2, py + w / 2 - (s > 1 ? tile * 0.1 : 0));
        if (b.level > 0 && b.kind !== 'builder_hut') {
          ctx.font = `${Math.max(8, tile * 0.5)}px system-ui`;
          ctx.fillStyle = '#fff';
          ctx.fillText(`${b.level}`, px + w - tile * 0.4, py + tile * 0.4);
        }
      }
    }

    if (o.battle && bb && alive && bb.hp < bb.maxHp) {
      ctx.fillStyle = '#000';
      ctx.fillRect(px + pad, py + w - pad - 3, w - pad * 2, 3);
      ctx.fillStyle = '#e06464';
      ctx.fillRect(px + pad, py + w - pad - 3, (w - pad * 2) * (bb.hp / bb.maxHp), 3);
    }

    if (!o.battle) {
      if (b.upgrade) {
        const frac = Math.min(1, (o.now - b.upgrade.startedAt) / Math.max(1, b.upgrade.finishAt - b.upgrade.startedAt));
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(px + pad, py + w - pad - 4, w - pad * 2, 4);
        ctx.fillStyle = '#f4b860';
        ctx.fillRect(px + pad, py + w - pad - 4, (w - pad * 2) * frac, 4);
      }
      if (def.category === 'resource' && b.level > 0) {
        const p = pendingProduction(b, o.now);
        const lv = def.levels[b.level - 1];
        if (p >= (lv.collectorCap ?? 1) * 0.1) {
          ctx.beginPath();
          ctx.fillStyle = def.resource === 'wood' ? '#c98a4b' : '#cfd6dd';
          ctx.arc(px + w - tile * 0.25, py + tile * 0.25, tile * 0.28, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#000';
          ctx.stroke();
        }
      }
      if (o.selectedId === b.id) {
        ctx.strokeStyle = '#f4b860';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, w - 2, w - 2);
      }
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
