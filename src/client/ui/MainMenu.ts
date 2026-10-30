import type { MapId } from '../../shared/maps/types';
import { ROLES, RoleId, Team } from '../../shared/roles';
import { fillStroke, makeCanvas, rr, vgrad } from '../art/draw';
import { INK } from '../art/palette';
import { audio } from '../audio/Audio';
import { store } from '../state';
import type { App } from './App';
import { clear, h, ICONS, modal, toast, uiRoot } from './dom';
import { showHowTo } from './HowTo';
import { mapCards } from './MapCards';
import { showPrefs } from './SettingsUI';

/** Fondo animado ligero: tres viajes en paralaje con sprites precalculados. */
function animatedBackground(): { el: HTMLCanvasElement; stop: () => void } {
  const c = makeCanvas(10, 10);
  c.className = 'menu-bg';
  const ctx = c.getContext('2d')!;
  const sprite = (w: number, hh: number, fn: (g: CanvasRenderingContext2D) => void) => { const s = makeCanvas(w, hh); const g = s.getContext('2d')!; g.lineJoin = 'round'; fn(g); return s; };
  const train = sprite(520, 70, (g) => {
    for (let i = 0; i < 4; i++) {
      const x = 10 + i * 128;
      rr(g, x, 10, 118, 42, 8); fillStroke(g, vgrad(g, 10, 52, i === 0 ? '#e04b58' : '#8c3443', i === 0 ? '#9e2531' : '#5d1f2b'), INK, 3);
      g.fillStyle = '#d9a441'; g.fillRect(x + 4, 34, 110, 3);
      for (let k = 0; k < 4; k++) { rr(g, x + 10 + k * 26, 18, 18, 12, 3); fillStroke(g, '#bfe3ff', INK, 1.5); }
      for (const wx of [x + 22, x + 96]) { g.beginPath(); g.arc(wx, 56, 8, 0, Math.PI * 2); fillStroke(g, '#2b2d42', INK, 2); }
    }
  });
  const ship = sprite(380, 140, (g) => {
    g.beginPath(); g.moveTo(10, 80); g.lineTo(370, 80); g.lineTo(330, 128); g.lineTo(40, 128); g.closePath(); fillStroke(g, '#20375c', INK, 3);
    g.fillStyle = '#e63946'; g.fillRect(30, 112, 310, 6);
    rr(g, 70, 44, 230, 38, 6); fillStroke(g, '#f1ede4', INK, 3);
    rr(g, 110, 16, 140, 30, 6); fillStroke(g, '#f1ede4', INK, 3);
    for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(90 + k * 30, 62, 6, 0, Math.PI * 2); fillStroke(g, '#5fa8d3', INK, 1.5); }
    rr(g, 230, 0, 34, 20, 4); fillStroke(g, '#d62828', INK, 3);
  });
  const plane = sprite(300, 120, (g) => {
    g.beginPath(); g.moveTo(130, 60); g.lineTo(190, 6); g.lineTo(210, 6); g.lineTo(180, 60); g.closePath(); fillStroke(g, '#c3ccd8', INK, 3);
    rr(g, 10, 48, 270, 34, 17); fillStroke(g, vgrad(g, 48, 82, '#ffffff', '#c9d2de'), INK, 3);
    g.beginPath(); g.moveTo(240, 50); g.lineTo(285, 14); g.lineTo(295, 14); g.lineTo(282, 56); g.closePath(); fillStroke(g, '#2f6fb3', INK, 3);
    for (let k = 0; k < 9; k++) { rr(g, 60 + k * 18, 56, 8, 9, 3); fillStroke(g, '#2f4f75', INK, 1); }
    g.fillStyle = '#2f6fb3'; g.fillRect(14, 70, 260, 4);
  });
  const cloud = sprite(220, 90, (g) => {
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y, r] of [[60, 55, 32], [100, 40, 40], [150, 52, 30], [120, 62, 30], [80, 64, 26]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  });
  let raf = 0;
  let stopped = false;
  const t0 = performance.now();
  const frame = () => {
    if (stopped) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const W = window.innerWidth, H = window.innerHeight;
    if (c.width !== Math.floor(W * dpr)) { c.width = Math.floor(W * dpr); c.height = Math.floor(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = (performance.now() - t0) / 1000;
    const slow = store.prefs.reduceMotion ? 0.2 : 1;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a2448'); sky.addColorStop(0.45, '#2c3e72'); sky.addColorStop(0.62, '#f28c5a'); sky.addColorStop(0.64, '#1f5f8f'); sky.addColorStop(0.8, '#174a72'); sky.addColorStop(0.82, '#55804a'); sky.addColorStop(1, '#2f4f2a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,220,150,0.25)'; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.6, 90, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) { const x = ((i * 330 - t * 30 * slow) % (W + 300) + W + 300) % (W + 300) - 220; ctx.globalAlpha = 0.5; ctx.drawImage(cloud, x, H * (0.08 + (i % 3) * 0.12)); }
    ctx.globalAlpha = 1;
    const px = W - ((t * 70 * slow) % (W + 600)) + 150;
    ctx.drawImage(plane, px, H * 0.2 + Math.sin(t * 0.8) * 6);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 18; i++) { const x = ((i * 120 - t * 50 * slow) % (W + 120) + W + 120) % (W + 120) - 60; ctx.fillRect(x, H * 0.66 + (i % 4) * 14, 40, 2); }
    const sx = W - ((t * 40 * slow + 400) % (W + 500)) + 100;
    ctx.save(); ctx.translate(sx, H * 0.6 + Math.sin(t * 1.1) * 3); ctx.rotate(Math.sin(t * 0.9) * 0.015); ctx.drawImage(ship, 0, 0); ctx.restore();
    ctx.fillStyle = '#3d3a35'; ctx.fillRect(0, H * 0.9, W, 10);
    ctx.fillStyle = '#6b4f35'; for (let x = -((t * 300 * slow) % 30); x < W; x += 30) ctx.fillRect(x, H * 0.9 - 2, 10, 14);
    ctx.fillStyle = '#c9ced8'; ctx.fillRect(0, H * 0.9, W, 3);
    const tx = W - ((t * 160 * slow + 900) % (W + 900)) + 300;
    ctx.drawImage(train, tx, H * 0.9 - 58 + Math.sin(t * 30) * 0.4);
    ctx.fillStyle = 'rgba(10,14,30,0.35)'; ctx.fillRect(0, 0, W, H);
    raf = requestAnimationFrame(frame);
  };
  // 30 FPS bastan para el fondo; se detiene al salir del menú.
  frame();
  return { el: c, stop: () => { stopped = true; cancelAnimationFrame(raf); } };
}

export function showMainMenu(app: App) {
  const root = uiRoot();
  clear(root);
  store.view = 'menu';
  const bg = animatedBackground();
  const nameInput = h('input', { type: 'text', maxLength: 16, placeholder: 'Tu nombre', value: store.prefs.name, 'aria-label': 'Nombre' }) as HTMLInputElement;
  nameInput.addEventListener('input', () => store.setPrefs({ name: nameInput.value.trim() }));
  const needName = () => {
    if (!store.prefs.name.trim()) {
      const names = ['Revisora Luz', 'Grumete Ian', 'Azafata Noa', 'Maquinista Leo', 'Sobrecargo Sol', 'Mozo Teo'];
      store.setPrefs({ name: names[Math.floor(Math.random() * names.length)] });
      nameInput.value = store.prefs.name;
    }
  };
  const go = (fn: () => void) => () => { audio.unlock(); audio.sfx('click'); needName(); fn(); };
  const screen = h('div', { class: 'screen' }, bg.el,
    h('div', { class: 'menu' },
      h('div', { class: 'left' },
        h('div', { class: 'logo' }, h('span', { class: 'the' }, 'THE'), h('span', { class: 'main' }, 'Worst ', h('span', { class: 'w' }, 'Travel')), h('span', { class: 'tag' }, 'TREN · BARCO · AVIÓN')),
        h('p', { class: 'muted', style: 'max-width:520px;text-align:center;margin:0;font-weight:700' }, 'Atiende al pasaje, repara averías y descubre quién quiere arruinar el viaje antes de que llegue hasta el responsable.'),
      ),
      h('div', { class: 'panel card' },
        h('div', { class: 'field' }, h('label', null, 'Tu nombre'), nameInput),
        h('button', { class: 'btn primary big', onclick: go(() => createDialog(app)), html: `${ICONS.plus}<span>CREAR SALA</span>` }),
        h('button', { class: 'btn info', onclick: go(() => joinDialog(app)), html: `${ICONS.key}<span>UNIRSE CON CÓDIGO</span>` }),
        h('button', { class: 'btn', onclick: go(() => practiceDialog(app)), html: `${ICONS.practice}<span>PRÁCTICA (un jugador)</span>` }),
        h('div', { class: 'row' },
          h('button', { class: 'btn ghost grow', onclick: go(() => showPrefs()), html: `${ICONS.gear}<span>AJUSTES</span>` }),
          h('button', { class: 'btn ghost grow', onclick: go(() => showHowTo()), html: `${ICONS.help}<span>CÓMO JUGAR</span>` }),
        ),
      ),
    ),
    h('div', { class: 'footer' }, 'The Worst Travel · Arte, sonido y código originales'),
  );
  root.append(screen);
  const obs = new MutationObserver(() => { if (!screen.isConnected) { bg.stop(); obs.disconnect(); } });
  obs.observe(root, { childList: true });
  audio.music('menu');
  const code = new URLSearchParams(location.search).get('sala');
  if (code) setTimeout(() => { needName(); joinDialog(app, code); }, 100);
}

function createDialog(app: App) {
  let map: MapId = 'train';
  let cap = 8;
  let preset = 'equilibrado';
  const cards = mapCards(map, (id) => { map = id; cards.set(id); audio.sfx('click'); });
  const capVal = h('span', { class: 'val' }, String(cap));
  const capInput = h('input', { type: 'range', min: 4, max: 12, step: 1, value: cap }) as HTMLInputElement;
  capInput.addEventListener('input', () => { cap = Number(capInput.value); capVal.textContent = String(cap); });
  const presetTabs = h('div', { class: 'tabs' });
  const presets: [string, string][] = [['clasico', 'CLÁSICO SIN ROLES'], ['equilibrado', 'EQUILIBRADO'], ['personalizado', 'PERSONALIZADO']];
  const renderTabs = () => {
    clear(presetTabs);
    for (const [id, name] of presets) presetTabs.append(h('button', { class: `tab${preset === id ? ' active' : ''}`, onclick: () => { preset = id; renderTabs(); } }, name));
  };
  renderTabs();
  const m = modal('Crear sala', h('div', { class: 'col' },
    h('div', { class: 'field' }, h('label', null, 'Vehículo'), cards.el),
    h('div', { class: 'slider' }, h('span', { class: 'name' }, 'Plazas'), capVal, capInput, h('span', { class: 'help' }, 'Entre 4 y 12 personas. Siempre hay un único impostor.')),
    h('div', { class: 'field' }, h('label', null, 'Preset de reglas'), presetTabs),
  ), {
    wide: true,
    actions: [h('button', { class: 'btn primary big', onclick: async () => { m.close(); toast('Creando sala…'); await app.createRoom(map, cap, preset); }, html: `${ICONS.play}<span>CREAR</span>` })],
  });
}

export function joinDialog(app: App, prefill = '') {
  const input = h('input', { type: 'text', class: 'code-input', maxLength: 5, placeholder: 'CÓDIGO', value: prefill, autocomplete: 'off', 'aria-label': 'Código de sala' }) as HTMLInputElement;
  const submit = async () => {
    const code = input.value.trim().toUpperCase();
    if (code.length < 5) { toast('El código tiene 5 caracteres.', 'warn'); return; }
    m.close();
    await app.joinRoom(code);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') void submit(); });
  const m = modal('Unirse con código', h('div', { class: 'col' }, h('p', { class: 'muted', style: 'margin:0' }, 'Pide el código a quien ha creado la sala.'), input), {
    actions: [h('button', { class: 'btn primary', onclick: () => void submit(), html: `${ICONS.key}<span>ENTRAR</span>` })],
  });
  setTimeout(() => input.focus(), 50);
}

function practiceDialog(app: App) {
  let map: MapId = 'train';
  let team: Team = 'worker';
  let role: RoleId | null = null;
  const cards = mapCards(map, (id) => { map = id; cards.set(id); });
  const teamTabs = h('div', { class: 'tabs' });
  const roleSel = h('select', { 'aria-label': 'Especialidad' }) as HTMLSelectElement;
  const fillRoles = () => {
    clear(roleSel);
    roleSel.append(h('option', { value: '' }, 'Sin especialidad'));
    for (const r of ROLES.filter((x) => x.team === team)) roleSel.append(h('option', { value: r.id }, `${r.name} — ${r.short}`));
    roleSel.value = role ?? '';
  };
  const renderTeam = () => {
    clear(teamTabs);
    for (const [id, name] of [['worker', 'TRABAJADOR'], ['impostor', 'IMPOSTOR']] as [Team, string][]) teamTabs.append(h('button', { class: `tab${team === id ? ' active' : ''}`, onclick: () => { team = id; role = null; renderTeam(); fillRoles(); } }, name));
  };
  roleSel.addEventListener('change', () => { role = (roleSel.value || null) as RoleId | null; });
  renderTeam(); fillRoles();
  const m = modal('Práctica individual', h('div', { class: 'col' },
    h('p', { class: 'muted', style: 'margin:0' }, 'Modo PRÁCTICA: un solo jugador, sin multijugador. Sirve para recorrer el mapa y probar tareas y sabotajes (en práctica también los trabajadores pueden provocar averías).'),
    h('div', { class: 'field' }, h('label', null, 'Vehículo'), cards.el),
    h('div', { class: 'row wrap' }, h('div', { class: 'field' }, h('label', null, 'Bando'), teamTabs), h('div', { class: 'field grow' }, h('label', null, 'Especialidad'), roleSel)),
  ), {
    wide: true,
    actions: [h('button', { class: 'btn primary big', onclick: async () => { m.close(); await app.startPractice(map, team, role); }, html: `${ICONS.play}<span>EMPEZAR PRÁCTICA</span>` })],
  });
}
