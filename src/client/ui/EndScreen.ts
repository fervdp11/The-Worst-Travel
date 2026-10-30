import { COLORS } from '../../shared/constants';
import type { EndResult } from '../../shared/protocol';
import { ROLE_BY_ID } from '../../shared/roles';
import { makeCanvas } from '../art/draw';
import { audio } from '../audio/Audio';
import { store } from '../state';
import type { App } from './App';
import { clear, h, ICONS, uiRoot } from './dom';
import { portrait } from './Portrait';

/** Pantalla de victoria/derrota con protagonistas animados y causa concreta. */
export function showEnd(app: App, r: EndResult) {
  clear(uiRoot());
  const me = store.net?.pid;
  const mine = r.roles.find((x) => x.id === me);
  const won = r.winner === 'cancelled' ? null : (mine?.team === 'impostor') === (r.winner === 'impostor');
  audio.sfx(won ? 'win' : 'lose');
  const winners = r.roles.filter((x) => (r.winner === 'impostor' ? x.team === 'impostor' : r.winner === 'workers' ? x.team === 'worker' : false));
  const stage = makeCanvas(1200, 340);
  const g = stage.getContext('2d')!;
  const sprites = winners.map((w) => portrait(w.color, 0, 90));
  let raf = 0;
  const t0 = performance.now();
  const anim = () => {
    const t = (performance.now() - t0) / 1000;
    g.clearRect(0, 0, 1200, 340);
    const n = sprites.length;
    sprites.forEach((s, i) => {
      const x = 600 + (i - (n - 1) / 2) * Math.min(160, 1100 / Math.max(1, n));
      const jump = won === false ? 0 : Math.abs(Math.sin(t * 4 + i)) * 26;
      g.save();
      g.translate(x, 300 - jump);
      g.rotate(won === false ? 0 : Math.sin(t * 3 + i) * 0.08);
      g.drawImage(s, -80, -170, 160, 170);
      g.restore();
    });
    if (won !== false && !store.prefs.reduceMotion) {
      for (let i = 0; i < 30; i++) {
        const cx = (i * 97 + t * 60 * (1 + (i % 3))) % 1200, cy = (t * 120 * (1 + (i % 4)) + i * 41) % 340;
        g.fillStyle = ['#ffd23f', '#ff8a3d', '#3ddc97', '#5cc8ff'][i % 4];
        g.fillRect(cx, cy, 8, 12);
      }
    }
    raf = requestAnimationFrame(anim);
  };
  anim();
  const title = r.winner === 'workers' ? 'GANAN LOS TRABAJADORES' : r.winner === 'impostor' ? 'GANA EL IMPOSTOR' : 'PARTIDA CANCELADA';
  const back = h('button', { class: 'btn primary big', onclick: () => { cancelAnimationFrame(raf); app.backToLobby(); }, html: `${ICONS.back}<span>VOLVER A LA SALA</span>` });
  const screen = h('div', { class: 'end' }, h('div', { class: 'panel' },
    h('h1', { class: r.winner === 'impostor' ? 'impostor' : 'workers' }, title),
    won !== null ? h('div', { class: 'title', style: 'font-size:1.4em' }, won ? '¡Victoria!' : 'Derrota') : null,
    h('h3', null, r.title), h('p', { style: 'margin:0' }, r.text),
    stage,
    h('div', { class: 'roles' }, r.roles.map((x) => h('div', { class: 'prow' },
      portrait(x.color, 0, 16),
      h('div', { class: 'col grow', style: 'gap:2px;min-width:0' },
        h('span', { class: 'nm', style: `color:${COLORS[x.color]?.hex}` }, x.name),
        h('span', { class: 'small muted' }, x.role ? ROLE_BY_ID[x.role].name : 'sin especialidad')),
      h('span', { class: `badge ${x.team}` }, x.team === 'worker' ? 'TRABAJADOR' : 'IMPOSTOR'),
    ))),
    h('div', { class: 'row', style: 'justify-content:center' }, back),
    h('div', { class: 'small muted' }, 'La sala vuelve a la espera con los mismos jugadores y ajustes.'),
  ));
  screen.querySelectorAll('.roles canvas').forEach((c) => { (c as HTMLCanvasElement).style.width = '28px'; (c as HTMLCanvasElement).style.height = '28px'; });
  uiRoot().append(screen);
}
