import { buy, cancelUpgrade, checkBuy, checkUpgrade, finishWithAsh, moveBuilding, upgrade, type Refusal } from '../game/build';
import { canTrain, dequeue, housingUsed, train, trainingProgress, trainTimeMs } from '../game/army';
import { BUILDINGS, SHOP_ORDER, levelDef, maxCount, maxLevel } from '../game/data/buildings';
import { TROOPS, TROOP_ORDER } from '../game/data/troops';
import { collect, pendingProduction, skipCost } from '../game/economy';
import { buildingAt, canPlaceAt, countOf, freeBuilders, hallLevel, storageCap, troopCapacity } from '../game/state';
import type { Building, BuildingKind, GameState } from '../game/types';
import { button, el, toast } from './dom';
import { fmtMs, fmtNum, fmtTime } from './format';
import { KIND_COLORS, TROOP_COLORS, type Ghost } from './renderer';

type Mode = { kind: 'idle' } | { kind: 'place'; building: BuildingKind } | { kind: 'move'; id: number } | { kind: 'paint_wall' };
type Tab = 'none' | 'building' | 'shop' | 'army' | 'log';

const REFUSAL_TEXT: Record<Refusal, string> = {
  ok: '',
  locked: 'Needs a higher Hall',
  count: 'Hall cap reached',
  max_level: 'Max level',
  hall_cap: 'Upgrade the Hall first',
  no_builder: 'All builders busy',
  resources: 'Not enough resources',
  busy: 'Already upgrading',
  placement: "Can't place there",
  ash: 'Not enough Ash',
};

export class VillageScreen {
  mode: Mode = { kind: 'idle' };
  tab: Tab = 'none';
  selectedId?: number;
  hoverTile?: { x: number; y: number };
  private panel = document.getElementById('panel')!;
  private lastRender = 0;

  constructor(
    private state: () => GameState,
    private now: () => number,
    private onChange: () => void,
    private openAttack: () => void,
    private openSettings: () => void,
  ) {}

  ghost(): Ghost | undefined {
    const t = this.hoverTile;
    if (!t) return undefined;
    const s = this.state();
    if (this.mode.kind === 'place') return { kind: this.mode.building, x: t.x, y: t.y, ok: canPlaceAt(s, this.mode.building, t.x, t.y) };
    if (this.mode.kind === 'paint_wall') return { kind: 'wall', x: t.x, y: t.y, ok: canPlaceAt(s, 'wall', t.x, t.y) };
    if (this.mode.kind === 'move') {
      const id = this.mode.id;
      const b = s.buildings.find((o) => o.id === id);
      if (b) return { kind: b.kind, x: t.x, y: t.y, ok: canPlaceAt(s, b.kind, t.x, t.y, b.id) };
    }
    return undefined;
  }

  hint(): string {
    switch (this.mode.kind) {
      case 'place':
        return `Tap a free spot to place the ${BUILDINGS[this.mode.building].name}`;
      case 'paint_wall':
        return 'Tap tiles to build walls. Tap Done when finished.';
      case 'move':
        return 'Tap where the building should go';
      default:
        return '';
    }
  }

  tap(x: number, y: number): void {
    const s = this.state();
    const now = this.now();
    this.hoverTile = { x, y };
    switch (this.mode.kind) {
      case 'place': {
        const r = buy(s, this.mode.building, x, y, now);
        if (typeof r === 'string') return toast(REFUSAL_TEXT[r]);
        toast(`${BUILDINGS[r.kind].name} placed`);
        this.mode = { kind: 'idle' };
        this.select(r.id);
        break;
      }
      case 'paint_wall': {
        const r = buy(s, 'wall', x, y, now);
        if (typeof r === 'string') {
          if (r !== 'placement') toast(REFUSAL_TEXT[r]);
          if (r === 'count' || r === 'resources') this.mode = { kind: 'idle' };
        }
        break;
      }
      case 'move': {
        const id = this.mode.id;
        const b = s.buildings.find((o) => o.id === id);
        if (b && moveBuilding(s, b, x, y)) {
          this.mode = { kind: 'idle' };
          this.select(b.id);
        } else toast(REFUSAL_TEXT.placement);
        break;
      }
      default: {
        const b = buildingAt(s, x, y);
        if (!b) {
          this.close();
          return;
        }
        if (this.selectedId === b.id && BUILDINGS[b.kind].category === 'resource') {
          const got = collect(s, b, now);
          if (got > 0) toast(`+${fmtNum(got)} ${BUILDINGS[b.kind].resource}`);
          else toast(pendingProduction(b, now) > 0 ? 'Storage full' : 'Nothing to collect yet');
        }
        this.select(b.id);
      }
    }
    this.onChange();
    this.render(true);
  }

  select(id: number): void {
    this.selectedId = id;
    this.tab = 'building';
    this.render(true);
  }

  close(): void {
    this.selectedId = undefined;
    this.tab = 'none';
    this.mode = { kind: 'idle' };
    this.render(true);
  }

  open(tab: Tab): void {
    if (this.tab === tab) return this.close();
    this.tab = tab;
    this.selectedId = undefined;
    this.mode = { kind: 'idle' };
    this.render(true);
  }

  /** Re-renders the panel. Called every frame; throttled unless forced. */
  render(force = false): void {
    const now = this.now();
    if (!force && now - this.lastRender < 500) return;
    this.lastRender = now;
    const panel = this.panel;
    if (this.tab === 'none') {
      panel.classList.add('hidden');
      panel.innerHTML = '';
      return;
    }
    const scroll = panel.scrollTop;
    panel.innerHTML = '';
    panel.classList.remove('hidden');
    const s = this.state();
    switch (this.tab) {
      case 'building': {
        const b = s.buildings.find((o) => o.id === this.selectedId);
        if (!b) return this.close();
        panel.append(this.buildingPanel(s, b, now));
        break;
      }
      case 'shop':
        panel.append(this.shopPanel(s));
        break;
      case 'army':
        panel.append(this.armyPanel(s, now));
        break;
      case 'log':
        panel.append(this.logPanel(s));
        break;
    }
    panel.scrollTop = scroll;
  }

  private header(title: string): HTMLElement {
    return el('h3', {}, [title, el('button', { class: 'close', click: () => this.close() }, ['×'])]);
  }

  private buildingPanel(s: GameState, b: Building, now: number): HTMLElement {
    const def = BUILDINGS[b.kind];
    const lv = levelDef(b.kind, Math.max(1, b.level));
    const hl = hallLevel(s);
    const title = b.level === 0 ? `${def.name} (building)` : `${def.name}  Lv ${b.level}`;
    const stats: string[] = [];
    if (lv.prod) stats.push(`${fmtNum(lv.prod)} ${def.resource}/h`);
    if (lv.collectorCap) stats.push(`holds ${fmtNum(lv.collectorCap)}`);
    if (lv.storage) stats.push(`stores ${fmtNum(lv.storage)}`);
    if (lv.dps) stats.push(`${lv.dps} dmg/s · range ${lv.range}`);
    if (lv.housing) stats.push(`houses ${lv.housing}`);
    stats.push(`${fmtNum(lv.hp)} hp`);
    if (b.kind === 'hall') stats.push(`max building level ${maxLevel('quarry', hl)}`);

    const actions = el('div', { class: 'row' });
    if (def.category === 'resource' && b.level > 0) {
      const p = pendingProduction(b, now);
      actions.append(
        button('Collect', `${fmtNum(p)} ${def.resource}`, () => {
          const got = collect(s, b, now);
          toast(got > 0 ? `+${fmtNum(got)} ${def.resource}` : 'Storage full');
          this.onChange();
          this.render(true);
        }, { cls: p > 0 ? 'primary' : '', disabled: p <= 0 }),
      );
    }
    if (b.upgrade) {
      const left = b.upgrade.finishAt - now;
      const ash = skipCost(left);
      actions.append(
        button('Finish now', `${ash} Ash · ${fmtMs(left)} left`, () => {
          const r = finishWithAsh(s, b, this.now());
          if (r !== 'ok') toast(REFUSAL_TEXT[r]);
          this.onChange();
          this.render(true);
        }, { cls: 'primary', disabled: s.resources.ash < ash }),
        button('Cancel', 'half refund', () => {
          cancelUpgrade(s, b);
          this.onChange();
          if (b.level === 0) this.close();
          else this.render(true);
        }, { cls: 'danger' }),
      );
    } else if (b.kind !== 'builder_hut') {
      const c = checkUpgrade(s, b);
      const next = b.level + 1;
      const nextLv = next <= def.levels.length ? levelDef(b.kind, next) : undefined;
      const sub =
        c.result === 'max_level'
          ? 'Max level'
          : c.result === 'hall_cap'
            ? `Needs Hall ${def.maxLevelByHall.findIndex((m) => m >= next) + 1}`
            : `${fmtNum(c.cost)} ${def.costResource}${nextLv && nextLv.time > 0 ? ` · ${fmtTime(nextLv.time)}` : ''}`;
      actions.append(
        button(`Upgrade to ${next}`, sub, () => {
          const r = upgrade(s, b, this.now());
          toast(r === 'ok' ? (def.needsBuilder && nextLv && nextLv.time > 0 ? 'Builder on the job' : `${def.name} is now level ${b.level}`) : REFUSAL_TEXT[r]);
          this.onChange();
          this.render(true);
        }, { cls: c.result === 'ok' ? 'primary' : '', disabled: c.result !== 'ok' }),
      );
      if (c.result !== 'ok' && c.result !== 'max_level' && c.result !== 'hall_cap') actions.append(el('p', { class: 'muted' }, [REFUSAL_TEXT[c.result]]));
    }
    if (b.kind !== 'wall') actions.append(button('Move', null, () => void (this.mode = { kind: 'move', id: b.id })));

    const extra: HTMLElement[] = [];
    if (b.kind === 'wall') {
      // Show neighbouring walls so the player can chain upgrades quickly.
      const neighbours = s.buildings.filter((o) => o.kind === 'wall' && o.id !== b.id && Math.abs(o.x - b.x) + Math.abs(o.y - b.y) === 1);
      const upgradable = neighbours.filter((o) => checkUpgrade(s, o).result === 'ok');
      if (upgradable.length) {
        extra.push(
          button(`Upgrade ${upgradable.length} adjacent`, `${fmtNum(upgradable.reduce((a, o) => a + checkUpgrade(s, o).cost, 0))} stone`, () => {
            let n = 0;
            for (const o of upgradable) if (upgrade(s, o, this.now()) === 'ok') n++;
            toast(`${n} wall segments upgraded`);
            this.onChange();
            this.render(true);
          }),
        );
      }
    }
    return el('div', {}, [
      this.header(title),
      el('div', { class: 'stats' }, stats.map((t) => el('span', {}, [t]))),
      el('p', {}, [def.description]),
      actions,
      extra.length ? el('div', { class: 'row' }, extra) : null,
    ]);
  }

  private shopPanel(s: GameState): HTMLElement {
    const hl = hallLevel(s);
    const items = SHOP_ORDER.map((kind) => {
      const def = BUILDINGS[kind];
      const c = checkBuy(s, kind);
      const have = countOf(s, kind);
      const max = maxCount(kind, hl);
      const lv = def.levels[0];
      const costText = kind === 'builder_hut' ? `${c.cost} Ash` : `${fmtNum(lv.cost)} ${def.costResource}${lv.time ? ` · ${fmtTime(lv.time)}` : ''}`;
      const locked = c.result === 'locked';
      return el('div', { class: 'item' }, [
        el('div', { class: 'swatch', style: `background:${KIND_COLORS[kind]}` }),
        el('div', { class: 'body' }, [
          el('b', {}, [`${def.name}  ${have}/${max}`]),
          el('small', {}, [locked ? `Unlocks at Hall ${def.unlockHall}` : costText]),
          el('small', {}, [def.description]),
        ]),
        button(kind === 'wall' ? 'Build' : 'Place', null, () => {
          if (kind === 'wall') this.mode = { kind: 'paint_wall' };
          else this.mode = { kind: 'place', building: kind };
          this.tab = 'none';
          this.render(true);
        }, { cls: c.result === 'ok' ? 'primary' : '', disabled: c.result !== 'ok' }),
      ]);
    });
    return el('div', {}, [
      this.header(`Shop · builders ${freeBuilders(s)}/${s.builders} free`),
      el('div', { class: 'list' }, items),
    ]);
  }

  private armyPanel(s: GameState, now: number): HTMLElement {
    const cap = troopCapacity(s);
    const used = housingUsed(s);
    const hl = hallLevel(s);
    const items = TROOP_ORDER.map((kind) => {
      const def = TROOPS[kind];
      const r = canTrain(s, kind);
      const queued = s.army.queue.filter((j) => j.kind === kind).reduce((a, j) => a + j.count, 0);
      const inBarracks = s.army.troops[kind];
      const locked = hl < def.unlockHall;
      return el('div', { class: 'item' }, [
        el('div', { class: 'swatch', style: `background:${TROOP_COLORS[kind]}; border-radius: 50%` }),
        el('div', { class: 'body' }, [
          el('b', {}, [`${def.name}  ×${inBarracks}${queued ? ` (+${queued} training)` : ''}`]),
          el('small', {}, [locked ? `Unlocks at Hall ${def.unlockHall}` : `${def.cost} wood · ${fmtMs(trainTimeMs(s, kind))} · ${def.housing} housing · ${def.hp} hp · ${def.damage} dmg`]),
          el('small', {}, [def.description]),
        ]),
        el('div', { class: 'row', style: 'margin:0; flex-direction: column' }, [
          button('+1', null, () => {
            const t = train(s, kind, now);
            if (t !== 'ok') toast({ locked: 'Needs a higher Hall', no_barracks: 'Build a Barracks first', housing: 'Barracks are full', resources: 'Not enough wood', ok: '' }[t]);
            this.onChange();
            this.render(true);
          }, { cls: r === 'ok' ? 'primary' : '', disabled: r !== 'ok' }),
          button('−1', null, () => {
            if (!dequeue(s, kind, now)) toast('Nothing queued');
            this.onChange();
            this.render(true);
          }, { disabled: queued === 0 }),
        ]),
      ]);
    });
    const head = s.army.queue[0];
    const progress = head
      ? el('div', {}, [
          el('small', { class: 'muted' }, [`Training ${TROOPS[head.kind].name}…`]),
          el('div', { class: 'progress' }, [el('i', { style: `width:${Math.round(trainingProgress(s, now) * 100)}%` })]),
        ])
      : null;
    return el('div', {}, [
      this.header(`Army · ${used}/${cap} housing`),
      countOf(s, 'barracks') === 0 ? el('p', { class: 'bad' }, ['Build a Barracks to train troops.']) : null,
      el('div', { class: 'list' }, items),
      progress,
      el('div', { class: 'row' }, [
        button('Attack!', `${used - s.army.queue.reduce((a, j) => a + j.count * TROOPS[j.kind].housing, 0)} housing ready`, () => this.openAttack(), {
          cls: 'primary',
          disabled: Object.values(s.army.troops).every((n) => n === 0),
        }),
      ]),
    ]);
  }

  private logPanel(s: GameState): HTMLElement {
    const items = s.raidLog.map((r) =>
      el('div', { class: 'item' }, [
        el('div', { class: 'body' }, [
          el('b', {}, [`${r.direction === 'attack' ? '⚔ Attacked' : '🛡 Raided by'} ${r.villageName}`]),
          el('small', {}, [`${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}  ${Math.round(r.destruction * 100)}% · ${fmtNum(r.loot.wood)} wood, ${fmtNum(r.loot.stone)} stone${r.ashEarned ? ` · +${r.ashEarned} Ash` : ''}`]),
          el('small', {}, [new Date(r.at).toLocaleString()]),
        ]),
      ]),
    );
    const st = s.stats;
    return el('div', {}, [
      this.header('Raid log'),
      el('div', { class: 'stats' }, [
        el('span', {}, [`${st.raids} raids`]),
        el('span', {}, [`${st.starsTotal} stars`]),
        el('span', {}, [`${fmtNum(st.lootWood)} wood looted`]),
        el('span', {}, [`${fmtNum(st.lootStone)} stone looted`]),
        el('span', {}, [`storage ${fmtNum(storageCap(s, 'wood'))} / ${fmtNum(storageCap(s, 'stone'))}`]),
      ]),
      items.length ? el('div', { class: 'list' }, items) : el('p', {}, ['No raids yet. Train some troops and go take what you need.']),
      el('div', { class: 'row' }, [button('Settings', null, () => this.openSettings())]),
    ]);
  }
}
