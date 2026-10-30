import type { GameMode, MapId } from '../../shared/maps/types';
import { ROLES, RoleId, Team } from '../../shared/roles';
import { fillStroke, makeCanvas, rr, vgrad } from '../art/draw';
import { INK } from '../art/palette';
import { audio } from '../audio/Audio';
import { store } from '../state';
import type { App } from './App';
import { clear, h, ICONS, modal, toast, uiRoot } from './dom';
import { showHowTo } from './HowTo';
import { mapCards, modeCards } from './MapCards';
import { showPrefs } from './SettingsUI';

/** Fondo animado ligero: barco, avión y la furgoneta del súper en paralaje con sprites precalculados. */
function animatedBackground(): { el: HTMLCanvasElement; stop: () => void } {
  const c = makeCanvas(10, 10);
  c.className = 'menu-bg';
  const ctx = c.getContext('2d')!;
  const sprite = (w: number, hh: number, fn: (g: CanvasRenderingContext2D) => void) => { const s = makeCanvas(w, hh); const g = s.getContext('2d')!; g.lineJoin = 'round'; fn(g); return s; };
  // Furgoneta de reparto del súper: el tercer modo del juego, por carretera.
  const van = sprite(250, 92, (g) => {
    rr(g, 8, 14, 168, 58, 8); fillStroke(g, vgrad(g, 14, 72, '#f1ede4', '#c9c3b6'), INK, 3);
    g.beginPath(); g.moveTo(176, 30); g.lineTo(214, 30); g.lineTo(238, 52); g.lineTo(238, 72); g.lineTo(176, 72); g.closePath(); fillStroke(g, '#ff8a3d', INK, 3);
    g.beginPath(); g.moveTo(184, 36); g.lineTo(210, 36); g.lineTo(226, 52); g.lineTo(184, 52); g.closePath(); fillStroke(g, '#bfe3ff', INK, 1.5);
    g.fillStyle = '#ff8a3d'; g.fillRect(10, 56, 164, 6);
    g.font = '900 22px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#20375c'; g.fillText('EL CARRITO', 92, 48);
    for (const wx of [48, 200]) { g.beginPath(); g.arc(wx, 74, 12, 0, Math.PI * 2); fillStroke(g, '#2b2d42', INK, 2.5); g.beginPath(); g.arc(wx, 74, 4, 0, Math.PI * 2); g.fillStyle = '#a8b1c8'; g.fill(); }
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
    // Carretera de la costa con su línea discontinua
    ctx.fillStyle = '#3b4250'; ctx.fillRect(0, H * 0.88, W, H * 0.12);
    ctx.fillStyle = '#e8e2d4'; for (let x = -((t * 220 * slow) % 60); x < W; x += 60) ctx.fillRect(x, H * 0.94, 30, 3);
    const vx = W - ((t * 120 * slow + 700) % (W + 700)) + 250;
    ctx.drawImage(van, vx, H * 0.88 - 62 + Math.abs(Math.sin(t * 9)) * 1.2);
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
      const names = ['Reponedora Luz', 'Grumete Ian', 'Azafata Noa', 'Cajero Leo', 'Sobrecargo Sol', 'Mozo Teo'];
      store.setPrefs({ name: names[Math.floor(Math.random() * names.length)] });
      nameInput.value = store.prefs.name;
    }
  };
  const go = (fn: () => void) => () => { audio.unlock(); audio.sfx('click'); needName(); fn(); };
  const screen = h('div', { class: 'screen' }, bg.el,
    h('div', { class: 'menu' },
      h('div', { class: 'left' },
        h('div', { class: 'logo' }, h('span', { class: 'the' }, 'THE'), h('span', { class: 'main' }, 'Worst ', h('span', { class: 'w' }, 'Travel')), h('span', { class: 'tag' }, 'BARCO · AVIÓN · SUPERMERCADO')),
        h('p', { class: 'muted', style: 'max-width:520px;text-align:center;margin:0;font-weight:700' }, 'Atiende al pasaje y repara averías en el barco o el avión, o haz la compra en el súper: descubre quién finge saber lo que hace.'),
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
  let mode: GameMode = 'travel';
  let map: MapId = 'ship';
  let cap = 8;
  let preset = 'equilibrado';
  const mapBox = h('div');
  let cards = mapCards(map, (id) => { map = id; cards.set(id); audio.sfx('click'); }, mode);
  const renderMaps = () => { clear(mapBox); cards = mapCards(map, (id) => { map = id; cards.set(id); audio.sfx('click'); }, mode); mapBox.append(cards.el); };
  const modes = modeCards(mode, (m) => { mode = m; map = m === 'market' ? 'market' : 'ship'; modes.set(m); renderMaps(); presetRow.classList.toggle('hidden', m === 'market'); audio.sfx('click'); });
  renderMaps();
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
  const presetRow = h('div', { class: 'field' }, h('label', null, 'Preset de especialidades (Viaje)'), presetTabs);
  const m = modal('Crear sala', h('div', { class: 'col' },
    h('div', { class: 'field' }, h('label', null, '1. Modo'), modes.el),
    h('div', { class: 'field' }, h('label', null, '2. Mapa'), mapBox),
    h('div', { class: 'slider' }, h('span', { class: 'name' }, 'Plazas'), capVal, capInput, h('span', { class: 'help' }, 'Entre 4 y 12 personas. Siempre hay un único impostor.')),
    presetRow,
  ), {
    wide: true,
    actions: [h('button', { class: 'btn primary big', onclick: async () => { m.close(); toast('Creando sala…'); await app.createRoom(map, cap, preset, mode); }, html: `${ICONS.play}<span>CREAR</span>` })],
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
  let map: MapId = 'ship';
  let team: Team = 'worker';
  let role: RoleId | null = null;
  const cards = mapCards(map, (id) => { map = id; cards.set(id); extra.set(id); roleField.classList.toggle('hidden', false); }, 'travel');
  const extra = mapCards('market', (id) => { map = id; cards.set(id); extra.set(id); roleField.classList.toggle('hidden', true); }, 'market');
  extra.set(map);
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
  const roleField = h('div', { class: 'field grow' }, h('label', null, 'Especialidad (solo Viaje)'), roleSel);
  renderTeam(); fillRoles();
  const m = modal('Práctica individual', h('div', { class: 'col' },
    h('p', { class: 'muted', style: 'margin:0' }, 'Modo PRÁCTICA: un solo jugador, sin multijugador. Sirve para recorrer el mapa y probar tareas y sabotajes (en práctica también los trabajadores pueden provocar averías).'),
    h('div', { class: 'field' }, h('label', null, 'Viaje'), cards.el),
    h('div', { class: 'field' }, h('label', null, 'Supermercado'), extra.el),
    h('div', { class: 'row wrap' }, h('div', { class: 'field' }, h('label', null, 'Bando'), teamTabs), roleField),
  ), {
    wide: true,
    actions: [h('button', { class: 'btn primary big', onclick: async () => { m.close(); await app.startPractice(map, team, role); }, html: `${ICONS.play}<span>EMPEZAR PRÁCTICA</span>` })],
  });
}
