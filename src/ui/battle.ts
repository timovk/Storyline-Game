import { TROOPS, TROOP_ORDER } from '../game/data/troops';
import { availableVillages, type AiVillage } from '../game/data/villages';
import { applyRaidResult, startRaid } from '../game/raid';
import { hallLevel } from '../game/state';
import type { GameState, RaidReport, TroopKind } from '../game/types';
import { deploy, destruction, endBattle, remainingTroops, stars, step, timeLeft, TICK, type BattleState } from '../game/battle/sim';
import { button, el, modal, toast } from './dom';
import { fmtNum, fmtTime } from './format';
import { TROOP_COLORS } from './renderer';

export class BattleScreen {
  battle?: BattleState;
  village?: AiVillage;
  deployKind?: TroopKind;
  speed = 1;
  private acc = 0;
  private panel = document.getElementById('panel')!;
  private lastRender = 0;

  constructor(
    private state: () => GameState,
    private now: () => number,
    private onDone: (report: RaidReport | null) => void,
  ) {}

  get active(): boolean {
    return !!this.battle;
  }

  /** Opens the village picker. */
  pick(): void {
    const s = this.state();
    const list = availableVillages(hallLevel(s)).map((v) => {
      const best = s.villageStars[v.id] ?? 0;
      return el('div', { class: 'item' }, [
        el('div', { class: 'body' }, [
          el('b', {}, [`${v.name}  (tier ${v.tier})  ${'★'.repeat(best)}${'☆'.repeat(3 - best)}`]),
          el('small', {}, [`${fmtNum(v.loot.wood)} wood · ${fmtNum(v.loot.stone)} stone available`]),
          el('small', {}, [v.blurb]),
        ]),
        button('Scout', null, () => this.scout(v), { cls: 'primary' }),
      ]);
    });
    modal(
      el('div', {}, [
        el('h2', {}, ['Pick a target']),
        el('p', {}, ['Deployed troops are spent whether they win or lose. Loot drips out as you deal damage.']),
        el('div', { class: 'list' }, list),
        el('div', { class: 'row' }, [button('Back', null, () => modal(null))]),
      ]),
    );
  }

  scout(v: AiVillage): void {
    modal(null);
    const s = this.state();
    this.village = v;
    this.battle = startRaid(s, v, Math.floor(this.now() % 2_147_483_647));
    this.deployKind = TROOP_ORDER.find((k) => s.army.troops[k] > 0);
    this.speed = 1;
    this.acc = 0;
    this.renderTray(true);
  }

  tap(x: number, y: number): void {
    const bs = this.battle;
    if (!bs || !this.deployKind) return;
    if (!deploy(bs, this.deployKind, x, y)) {
      if (bs.remaining[this.deployKind] <= 0) toast(`No ${TROOPS[this.deployKind].name} left`);
      else toast('Deploy outside the village, away from buildings');
      return;
    }
    if (bs.remaining[this.deployKind] <= 0) this.deployKind = TROOP_ORDER.find((k) => bs.remaining[k] > 0);
    this.renderTray(true);
  }

  /** Advances the simulation by real elapsed milliseconds. */
  update(dtMs: number): void {
    const bs = this.battle;
    if (!bs) return;
    if (bs.started && !bs.over) {
      this.acc += (dtMs / 1000) * this.speed;
      let steps = 0;
      while (this.acc >= TICK && steps < 50) {
        step(bs);
        this.acc -= TICK;
        steps++;
      }
    }
    if (bs.over) this.finish();
    else this.renderTray(false);
  }

  banner(): { left: string; right: string } {
    const bs = this.battle!;
    const left = bs.started ? `${fmtTime(timeLeft(bs))} · ${Math.round(destruction(bs) * 100)}% · ${'★'.repeat(stars(bs))}` : `Scouting ${this.village!.name}`;
    const right = `${fmtNum(bs.loot.wood)} wood · ${fmtNum(bs.loot.stone)} stone`;
    return { left, right };
  }

  private finish(): void {
    const bs = this.battle!;
    const v = this.village!;
    const s = this.state();
    const report = applyRaidResult(s, v, bs, this.now());
    this.battle = undefined;
    this.village = undefined;
    this.panel.classList.add('hidden');
    this.panel.innerHTML = '';
    modal(
      el('div', {}, [
        el('h2', {}, [report.stars > 0 ? 'Victory' : 'Repelled']),
        el('div', { class: 'stars' }, [`${'★'.repeat(report.stars)}${'☆'.repeat(3 - report.stars)}`]),
        el('p', {}, [`${Math.round(report.destruction * 100)}% of ${v.name} destroyed.`]),
        el('p', {}, [`Loot: ${fmtNum(report.loot.wood)} wood, ${fmtNum(report.loot.stone)} stone${report.ashEarned ? `, +${report.ashEarned} Ash for new stars` : ''}.`]),
        el('p', {}, [`${report.troopsLost} troops fell. The rest went home.`]),
        bs.events.length ? el('p', { class: 'muted' }, [bs.events.slice(-4).join(' · ')]) : null,
        el('div', { class: 'row' }, [button('Return home', null, () => {
          modal(null);
          this.onDone(report);
        }, { cls: 'primary' })]),
      ]),
    );
  }

  private renderTray(force: boolean): void {
    const bs = this.battle;
    if (!bs) return;
    const now = this.now();
    if (!force && now - this.lastRender < 250) return;
    this.lastRender = now;
    const panel = this.panel;
    panel.innerHTML = '';
    panel.classList.remove('hidden');
    const tray = el('div', { class: 'tray', style: 'padding:0; background:none; border:0' });
    for (const kind of TROOP_ORDER) {
      const n = bs.remaining[kind];
      const b = button(TROOPS[kind].name, `×${n}`, () => {
        this.deployKind = kind;
        this.renderTray(true);
      }, { cls: this.deployKind === kind ? 'sel' : '', disabled: n <= 0 });
      b.style.borderLeft = `4px solid ${TROOP_COLORS[kind]}`;
      tray.append(b);
    }
    const controls = el('div', { class: 'row' }, [
      bs.started
        ? button(`Speed ×${this.speed}`, null, () => {
            this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
            this.renderTray(true);
          })
        : null,
      bs.started
        ? button('End battle', null, () => endBattle(bs, 'ended'), { cls: 'danger' })
        : button('Back home', null, () => {
            this.battle = undefined;
            this.village = undefined;
            panel.classList.add('hidden');
            this.onDone(null);
          }),
      el('span', { class: 'muted', style: 'font-size:12px; align-self:center' }, [
        bs.started ? `${remainingTroops(bs)} troops left to deploy` : 'Tap the tinted ground to deploy. The clock starts with your first troop.',
      ]),
    ]);
    panel.append(el('h3', {}, [this.village!.name]), tray, controls);
  }
}
