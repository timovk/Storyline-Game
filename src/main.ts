import { settleTraining } from './game/army';
import { settleUpgrades } from './game/build';
import { BUILDINGS } from './game/data/buildings';
import { maybeCounterRaid } from './game/raid';
import { load, save, timeShift, wipe } from './game/save';
import { freeBuilders, hallLevel, newGame, storageCap } from './game/state';
import type { GameState, RaidReport } from './game/types';
import { BattleScreen } from './ui/battle';
import { button, confirmModal, el, modal, toast } from './ui/dom';
import { fmtMs, fmtNum } from './ui/format';
import { Renderer } from './ui/renderer';
import { VillageScreen } from './ui/village';

const DEV = new URLSearchParams(location.search).has('dev');
const now = () => Date.now();

let state: GameState = load(localStorage, now());
settleUpgrades(state, now());
settleTraining(state, now());
const nightRaid = maybeCounterRaid(state, now());

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const hud = document.getElementById('hud')!;
const bar = document.getElementById('bar')!;
const map = document.getElementById('map')!;
const banner = el('div', { class: 'banner hidden' });
const hint = el('div', { class: 'hint' });
map.append(banner, hint);

function persist(): void {
  save(localStorage, state, now());
}

const village = new VillageScreen(
  () => state,
  now,
  persist,
  () => battle.pick(),
  () => openSettings(),
);
const battle = new BattleScreen(
  () => state,
  now,
  () => {
    persist();
    renderBar();
    village.close();
  },
);

// --- bottom bar -------------------------------------------------------------
function renderBar(): void {
  bar.innerHTML = '';
  if (battle.active) return;
  const tabs: Array<[string, () => void, boolean]> = [
    ['Shop', () => village.open('shop'), village.tab === 'shop'],
    ['Army', () => village.open('army'), village.tab === 'army'],
    ['Attack', () => battle.pick(), false],
    ['Log', () => village.open('log'), village.tab === 'log'],
  ];
  for (const [label, fn, active] of tabs) {
    bar.append(el('button', { class: active ? 'active' : '', click: () => { fn(); renderBar(); } }, [label]));
  }
}

// --- HUD --------------------------------------------------------------------
let lastHud = 0;
function renderHud(force = false): void {
  const t = now();
  if (!force && t - lastHud < 500) return;
  lastHud = t;
  const r = state.resources;
  const shield = state.shieldUntil > t ? `🛡 ${fmtMs(state.shieldUntil - t)}` : '';
  hud.innerHTML = '';
  hud.append(
    el('div', { class: 'res wood' }, [el('b', {}, [fmtNum(r.wood)]), el('small', {}, [`wood / ${fmtNum(storageCap(state, 'wood'))}`])]),
    el('div', { class: 'res stone' }, [el('b', {}, [fmtNum(r.stone)]), el('small', {}, [`stone / ${fmtNum(storageCap(state, 'stone'))}`])]),
    el('div', { class: 'res ash' }, [el('b', {}, [String(r.ash)]), el('small', {}, ['ash'])]),
    el('div', { class: 'res' }, [el('b', {}, [`${freeBuilders(state)}/${state.builders}`]), el('small', {}, ['builders free'])]),
    el('div', { class: 'spacer' }),
    el('div', { class: 'res' }, [el('b', {}, [`Hall ${hallLevel(state)}`]), el('small', { class: 'shield' }, [shield])]),
  );
}

// --- settings ---------------------------------------------------------------
function openSettings(): void {
  const devTools = DEV
    ? el('div', {}, [
        el('p', { class: 'muted' }, ['Dev tools']),
        el('div', { class: 'row' }, [
          button('+1 hour', null, () => { timeShift(state, 3_600_000); persist(); toast('An hour passed'); }),
          button('+1 day', null, () => { timeShift(state, 86_400_000); persist(); toast('A day passed'); }),
          button('+10k res', null, () => { state.resources.wood += 10_000; state.resources.stone += 10_000; state.resources.ash += 500; persist(); }),
          button('Night raid', 'simulate 4h away', () => {
            state.lastSeenAt = now() - 4 * 3_600_000;
            state.shieldUntil = 0;
            const r = maybeCounterRaid(state, now());
            persist();
            modal(null);
            if (r) showRaidedModal(r);
            else toast('The raiders found nothing worth taking');
          }),
        ]),
      ])
    : el('p', { class: 'muted' }, ['Add ?dev to the URL for time-skip tools.']);
  modal(
    el('div', {}, [
      el('h2', {}, ['Emberhold']),
      el('p', {}, ['Progress is saved in this browser only.']),
      devTools,
      el('div', { class: 'row' }, [
        button('Reset village', 'cannot be undone', () => confirmModal('Start over?', 'Your village, army and raid log will be wiped.', () => {
          wipe(localStorage);
          state = newGame(now());
          persist();
          village.close();
          renderBar();
          toast('A new campfire is lit');
        }), { cls: 'danger' }),
        button('Close', null, () => modal(null)),
      ]),
    ]),
  );
}

// --- input ------------------------------------------------------------------
canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  const t = renderer.tileAt(ev);
  if (battle.active) battle.tap(t.x, t.y);
  else {
    village.tap(t.x, t.y);
    renderBar();
  }
});
canvas.addEventListener('pointermove', (ev) => {
  village.hoverTile = renderer.tileAt(ev);
});

// --- hint strip under the map -----------------------------------------------
let lastHintKey = '';
function renderHint(): void {
  const key = battle.active ? '' : village.mode.kind + ':' + village.hint();
  if (key === lastHintKey) return;
  lastHintKey = key;
  hint.innerHTML = '';
  hint.style.pointerEvents = 'none';
  if (!key) return;
  hint.append(village.hint());
  if (village.mode.kind === 'paint_wall') {
    hint.style.pointerEvents = 'auto';
    hint.append(' ', button('Done', null, () => void (village.mode = { kind: 'idle' }), { cls: 'primary' }));
  }
}

new ResizeObserver(() => renderer.resize()).observe(map);

// --- main loop --------------------------------------------------------------
let barShowsBattle = false;
let lastFrame = now();
let lastSave = now();
function frame(): void {
  const t = now();
  const dt = Math.min(250, t - lastFrame);
  lastFrame = t;
  if (battle.active !== barShowsBattle) {
    barShowsBattle = battle.active;
    renderBar();
  }

  if (battle.active) {
    const wasActive = true;
    battle.update(dt);
    if (wasActive && battle.active) {
      const bs = battle.battle!;
      renderer.draw({ buildings: battle.village!.buildings, now: t, battle: bs, deployKind: battle.deployKind });
      const b = battle.banner();
      banner.classList.remove('hidden');
      banner.innerHTML = '';
      banner.append(el('span', {}, [b.left]), el('span', {}, [b.right]));
      renderHint();
    } else {
      banner.classList.add('hidden');
      renderBar();
    }
  } else {
    for (const done of settleUpgrades(state, t)) toast(`${BUILDINGS[done.kind].name} ${done.level === 1 ? 'built' : `reached level ${done.level}`}`);
    settleTraining(state, t);
    renderer.draw({ buildings: state.buildings, now: t, selectedId: village.selectedId, ghost: village.ghost() });
    banner.classList.add('hidden');
    renderHint();
    village.render();
  }
  renderHud();
  if (t - lastSave > 5000) {
    persist();
    lastSave = t;
  }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) persist();
  else renderer.resize();
});
window.addEventListener('pagehide', persist);

renderBar();
renderHud(true);
requestAnimationFrame(frame);

function showRaidedModal(r: RaidReport): void {
  modal(
    el('div', {}, [
      el('h2', {}, ['You were raided']),
      el('div', { class: 'stars' }, [`${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}`]),
      el('p', {}, [`${r.villageName} hit your village while you were away. ${Math.round(r.destruction * 100)}% destroyed.`]),
      el('p', {}, [`They took ${fmtNum(r.loot.wood)} wood and ${fmtNum(r.loot.stone)} stone. ${r.troopsLost} of their raiders got away.`]),
      el('p', {}, [`Your village rebuilt itself overnight. A shield keeps you safe for ${fmtMs(state.shieldUntil - now())}.`]),
      el('div', { class: 'row' }, [button('Noted', null, () => modal(null), { cls: 'primary' })]),
    ]),
  );
}

if (nightRaid) {
  showRaidedModal(nightRaid);
} else if (state.createdAt === state.lastSeenAt || state.stats.raids === 0 && state.buildings.length <= 4) {
  modal(
    el('div', {}, [
      el('h2', {}, ['Welcome to Emberhold']),
      el('p', {}, ['Tap the Quarry and Lumber Camp to collect what they gather. Open the Shop to build a Barracks and an Archer Post. Train Militia, then raid the Mudflats Camp for extra stone.']),
      el('p', {}, ['Your builder can only do one job at a time. A second hut costs Ash.']),
      el('div', { class: 'row' }, [button("Let's go", null, () => modal(null), { cls: 'primary' })]),
    ]),
  );
}
