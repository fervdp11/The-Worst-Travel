import { getMap } from '../../shared/maps';
import type { MapId } from '../../shared/maps/types';
import { ROLES, RoleDef } from '../../shared/roles';
import { effectiveCriticalTime, GAME_FIELDS, GameSettings, RoomSettings, validateSettings } from '../../shared/settings';
import { audio } from '../audio/Audio';
import { Prefs, store } from '../state';
import { clear, h, ICONS, modal } from './dom';
import { mapCards } from './MapCards';

type Refresher = () => void;

interface SliderOpts {
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  help?: string;
  get: () => number;
  set: (v: number) => void;
  readonly?: boolean;
  fieldKey?: string;
  fmt?: (v: number) => string;
}

export function slider(o: SliderOpts, refreshers: Refresher[]): HTMLElement {
  const val = h('span', { class: 'val' });
  const input = h('input', { type: 'range', min: o.min, max: o.max, step: o.step, 'aria-label': o.label }) as HTMLInputElement;
  const fmt = (v: number) => (o.fmt ? o.fmt(v) : `${Number.isInteger(o.step) ? v : v.toFixed(o.step < 0.1 ? 2 : 1)}${o.unit ? (o.unit === '×' ? '×' : ` ${o.unit}`) : ''}`);
  const clamp = (v: number) => Math.min(o.max, Math.max(o.min, Math.round(v / o.step) * o.step));
  const apply = (v: number) => { const c = Math.round(clamp(v) * 1000) / 1000; input.value = String(c); val.textContent = fmt(c); o.set(c); };
  input.addEventListener('input', () => apply(Number(input.value)));
  const minus = h('button', { class: 'btn step ghost', type: 'button', 'aria-label': 'Menos', onclick: () => { apply(o.get() - o.step); audio.sfx('click'); } }, '−');
  const plus = h('button', { class: 'btn step ghost', type: 'button', 'aria-label': 'Más', onclick: () => { apply(o.get() + o.step); audio.sfx('click'); } }, '+');
  const el = h('div', { class: `slider${o.readonly ? ' readonly' : ''}`, 'data-field': o.fieldKey ?? '' },
    h('span', { class: 'name' }, o.label), h('span', { class: 'ctrl' }, minus, val, plus), input, o.help ? h('span', { class: 'help' }, o.help) : null);
  const refresh = () => { const v = o.get(); if (document.activeElement !== input) input.value = String(v); val.textContent = fmt(v); };
  refresh();
  refreshers.push(refresh);
  return el;
}

export function toggle(label: string, get: () => boolean, set: (v: boolean) => void, refreshers: Refresher[], readonly = false, help?: string): HTMLElement {
  const el = h('div', { class: `toggle${readonly ? ' disabled' : ''}`, role: 'switch', tabindex: 0 }, h('span', { class: 'sw' }), h('span', null, label));
  const click = () => { if (readonly) return; set(!get()); refresh(); audio.sfx('click'); };
  el.addEventListener('click', click);
  el.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); click(); } });
  const refresh = () => { el.classList.toggle('on', get()); el.setAttribute('aria-checked', String(get())); };
  refresh();
  refreshers.push(refresh);
  return help ? h('div', { class: 'col', style: 'gap:2px' }, el, h('span', { class: 'small muted' }, help)) : el;
}

/** Ajustes de partida del anfitrión (los invitados ven exactamente lo mismo en modo lectura). */
export function showHostSettings(initialTab: 'partida' | 'mapa' | 'roles' = 'partida') {
  const room = store.room;
  if (!room) return;
  const isHost = room.hostId === store.net?.pid;
  const ro = !isHost;
  const refreshers: Refresher[] = [];
  let tab = initialTab;
  let roleFilter: 'all' | 'worker' | 'impostor' = 'all';
  const s = () => store.room!.settings;
  let pending: Record<string, unknown> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const send = (patch: Record<string, unknown>) => {
    if (ro) return;
    pending = deepMerge(pending ?? {}, { ...patch, preset: 'personalizado' });
    // Actualización optimista local
    store.room!.settings = deepMerge(store.room!.settings, patch) as RoomSettings;
    store.room!.settings.preset = 'personalizado';
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { store.net?.emit('settings', { patch: pending }); pending = null; }, 160);
    refreshIssues();
  };
  const issuesBox = h('div');
  const refreshIssues = () => {
    clear(issuesBox);
    const humans = store.room!.players.filter((p) => p.connected).length;
    const iss = validateSettings(s(), Math.max(humans, 4));
    document.querySelectorAll('.slider.invalid').forEach((e) => e.classList.remove('invalid'));
    if (!iss.length) return;
    issuesBox.append(h('ul', { class: 'issues' }, iss.map((i) => h('li', null, i.msg))));
    for (const i of iss) document.querySelectorAll(`[data-field^="${i.field.split('.').slice(0, 2).join('.')}"]`).forEach((e) => e.classList.add('invalid'));
  };
  const body = h('div', { class: 'col' });
  const tabs = h('div', { class: 'tabs' });
  const gameField = (key: keyof GameSettings) => {
    const f = GAME_FIELDS.find((x) => x.key === key)!;
    let help = f.help;
    if (key === 'criticalTime') help += ` Efectivo en ${getMap(store.room!.mapId).texts.short.toLowerCase()}: ${effectiveCriticalTime(s().game, getMap(store.room!.mapId).critTimeScale)} s.`;
    return slider({ label: f.label, min: f.min, max: f.max, step: f.step, unit: f.unit, help, readonly: ro, fieldKey: `game.${key}`, get: () => s().game[key] as number, set: (v) => send({ game: { [key]: v } }) }, refreshers);
  };
  const render = () => {
    refreshers.length = 0;
    clear(tabs); clear(body);
    for (const [id, name] of [['partida', 'PARTIDA'], ['mapa', 'MAPA'], ['roles', 'ROLES']] as const) tabs.append(h('button', { class: `tab${tab === id ? ' active' : ''}`, onclick: () => { tab = id; render(); } }, name));
    if (ro) body.append(h('div', { class: 'badge' }, 'Modo lectura: solo el anfitrión puede editar'));
    body.append(issuesBox);
    if (tab === 'partida') {
      const presetRow = h('div', { class: 'row wrap' }, h('span', { class: 'muted small' }, `Preset actual: ${({ clasico: 'CLÁSICO SIN ROLES', equilibrado: 'EQUILIBRADO', personalizado: 'PERSONALIZADO' } as const)[s().preset]}`));
      if (!ro) for (const [id, name] of [['clasico', 'Restaurar CLÁSICO'], ['equilibrado', 'Restaurar EQUILIBRADO']]) presetRow.append(h('button', { class: 'btn ghost', onclick: () => { store.net?.emit('settings', { patch: { preset: id } }); } }, name));
      body.append(presetRow);
      const grid = h('div', { class: 'roles-grid' });
      for (const f of GAME_FIELDS.filter((x) => x.tab === 'partida')) grid.append(gameField(f.key));
      body.append(grid);
      body.append(h('div', { class: 'row wrap', style: 'gap:22px' },
        toggle('Votos anónimos', () => s().game.anonymousVotes, (v) => send({ game: { anonymousVotes: v } }), refreshers, ro),
        toggle('Revelar bando al expulsar', () => s().game.revealTeam, (v) => send({ game: { revealTeam: v } }), refreshers, ro),
        toggle('Tareas visuales', () => s().game.visualTasks, (v) => send({ game: { visualTasks: v } }), refreshers, ro, 'Desactivado por defecto: evita pruebas automáticas de inocencia.'),
      ));
      const tb = h('div', { class: 'tabs' });
      const renderTb = () => { clear(tb); for (const [id, name] of [['always', 'Siempre'], ['meetings', 'Al reunirse'], ['never', 'Nunca']] as const) tb.append(h('button', { class: `tab${s().game.taskBarMode === id ? ' active' : ''}`, disabled: ro, onclick: () => { send({ game: { taskBarMode: id } }); renderTb(); } }, name)); };
      renderTb();
      body.append(h('div', { class: 'field' }, h('label', null, 'Actualización de la barra de tareas'), tb));
    } else if (tab === 'mapa') {
      const cards = mapCards(store.room!.mapId, ro ? null : (id: MapId) => { store.net?.emit('settings', { patch: null, mapId: id }); cards.set(id); });
      body.append(h('p', { class: 'small muted', style: 'margin:0' }, 'Cambiar de mapa descarta tareas y objetos de la próxima partida, pero conserva jugadores y ajustes. Los plazos críticos se ajustan a las distancias de cada vehículo.'), cards.el);
      const grid = h('div', { class: 'roles-grid' });
      for (const f of GAME_FIELDS.filter((x) => x.tab === 'mapa')) grid.append(gameField(f.key));
      body.append(grid);
    } else {
      const filt = h('div', { class: 'tabs' });
      for (const [id, name] of [['all', 'Todos'], ['worker', 'Trabajadores'], ['impostor', 'Impostor']] as const) filt.append(h('button', { class: `tab${roleFilter === id ? ' active' : ''}`, onclick: () => { roleFilter = id; render(); } }, name));
      body.append(h('div', { class: 'row wrap' }, filt, h('span', { class: 'small muted grow' }, 'El porcentaje es de candidatura: con pocas plazas, la asignación final depende de la disponibilidad. 100 % garantiza la plaza; 0 % no participa.')));
      const grid = h('div', { class: 'roles-grid' });
      for (const r of ROLES.filter((x) => roleFilter === 'all' || x.team === roleFilter)) grid.append(roleBox(r, ro, send, refreshers));
      body.append(grid);
    }
    refreshIssues();
  };
  render();
  const off = store.on('room', () => {
    if (!store.room) { m.close(); return; }
    if (pending) return;
    for (const r of refreshers) r();
    refreshIssues();
  });
  const m = modal(isHost ? 'Ajustes de la sala' : 'Ajustes de la sala (lectura)', h('div', { class: 'col' }, tabs, body), { wide: true, onClose: () => off() });
}

function roleBox(r: RoleDef, ro: boolean, send: (p: Record<string, unknown>) => void, refreshers: Refresher[]): HTMLElement {
  const s = () => store.room!.settings.roles[r.id];
  const maxCap = r.team === 'impostor' ? 1 : Math.max(1, (store.room?.settings.game.maxPlayers ?? 8) - 1);
  const box = h('div', { class: `rolebox ${r.team}` },
    h('div', { class: 'rh', html: `${ICON(r.id)}` }),
  );
  const rh = box.querySelector('.rh')!;
  rh.append(h('h4', null, r.name), h('span', { class: `badge ${r.team}` }, r.team === 'worker' ? 'TRABAJADOR' : 'IMPOSTOR'));
  box.append(h('p', null, r.desc));
  box.append(toggle('Activado', () => s().enabled, (v) => send({ roles: { [r.id]: { enabled: v, chance: v ? Math.max(5, s().chance || (r.team === 'worker' ? 25 : 15)) : 0 } } }), refreshers, ro));
  box.append(slider({ label: 'Posibilidad de candidatura', min: 0, max: 100, step: 5, unit: '%', readonly: ro, fieldKey: `roles.${r.team}`, help: 'Cada plaza tira con este porcentaje al comenzar.', get: () => (s().enabled ? s().chance : 0), set: (v) => send({ roles: { [r.id]: { chance: v, enabled: v > 0 } } }) }, refreshers));
  box.append(slider({ label: 'Máximo con este rol', min: 0, max: maxCap, step: 1, readonly: ro || r.team === 'impostor', fieldKey: `role.${r.id}.max`, help: r.team === 'impostor' ? 'Solo hay un impostor por partida.' : undefined, get: () => s().max, set: (v) => send({ roles: { [r.id]: { max: v } } }) }, refreshers));
  for (const p of r.params) {
    box.append(slider({ label: p.label, min: p.min, max: p.max, step: p.step, unit: p.unit === 'u' ? 'u' : p.unit === 'usos' ? '' : p.unit, readonly: ro, help: p.help, get: () => s().params[p.key], set: (v) => send({ roles: { [r.id]: { params: { [p.key]: v } } } }) }, refreshers));
  }
  return box;
}

function ICON(id: string) {
  return ICONS[id] ?? ICONS.help;
}

function deepMerge(a: any, b: any): any {
  if (b === null || typeof b !== 'object' || Array.isArray(b)) return b;
  const out = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b)) out[k] = typeof v === 'object' && v !== null && !Array.isArray(v) ? deepMerge(out[k], v) : v;
  return out;
}

/** Ajustes personales: GRÁFICOS, AUDIO y CONTROLES (se pueden cambiar en cualquier momento). */
export function showPrefs() {
  const refreshers: Refresher[] = [];
  let tab: 'graficos' | 'audio' | 'controles' = 'graficos';
  const p = () => store.prefs;
  const set = (patch: Partial<Prefs>) => store.setPrefs(patch);
  const tabs = h('div', { class: 'tabs' });
  const body = h('div', { class: 'col' });
  const render = () => {
    refreshers.length = 0;
    clear(tabs); clear(body);
    for (const [id, name] of [['graficos', 'GRÁFICOS'], ['audio', 'AUDIO'], ['controles', 'CONTROLES']] as const) tabs.append(h('button', { class: `tab${tab === id ? ' active' : ''}`, onclick: () => { tab = id; render(); } }, name));
    if (tab === 'graficos') {
      const q = h('div', { class: 'tabs' });
      const renderQ = () => { clear(q); for (const [id, name] of [['bajo', 'BAJO'], ['medio', 'MEDIO'], ['alto', 'ALTO']] as const) q.append(h('button', { class: `tab${p().quality === id ? ' active' : ''}`, onclick: () => { set({ quality: id }); renderQ(); } }, name)); };
      renderQ();
      body.append(h('div', { class: 'field' }, h('label', null, 'Calidad gráfica'), q, h('span', { class: 'small muted' }, 'Cambia resolución de texturas, densidad de píxeles y suavizado de niebla. Nunca altera paredes, visión ni reglas. Se aplica al cargar el siguiente mapa.')));
      body.append(slider({ label: 'Intensidad de efectos', min: 0, max: 1, step: 0.1, get: () => p().effects, set: (v) => set({ effects: v }) }, refreshers));
      body.append(slider({ label: 'Escala de interfaz', min: 0.8, max: 1.4, step: 0.05, unit: '×', get: () => p().uiScale, set: (v) => set({ uiScale: v }) }, refreshers));
      body.append(h('div', { class: 'row wrap', style: 'gap:22px' },
        toggle('Reducir movimiento', () => p().reduceMotion, (v) => set({ reduceMotion: v }), refreshers),
        toggle('Sacudidas y balanceo', () => p().shake, (v) => set({ shake: v }), refreshers),
        toggle('Panel de diagnóstico', () => p().diagnostics, (v) => set({ diagnostics: v }), refreshers),
      ));
    } else if (tab === 'audio') {
      body.append(slider({ label: 'Volumen general', min: 0, max: 1, step: 0.05, get: () => p().master, set: (v) => set({ master: v }), fmt: (v) => `${Math.round(v * 100)} %` }, refreshers));
      body.append(slider({ label: 'Música', min: 0, max: 1, step: 0.05, get: () => p().music, set: (v) => set({ music: v }), fmt: (v) => `${Math.round(v * 100)} %` }, refreshers));
      body.append(slider({ label: 'Efectos', min: 0, max: 1, step: 0.05, get: () => p().sfx, set: (v) => set({ sfx: v }), fmt: (v) => `${Math.round(v * 100)} %` }, refreshers));
      body.append(slider({ label: 'Ambiente', min: 0, max: 1, step: 0.05, get: () => p().ambience, set: (v) => set({ ambience: v }), fmt: (v) => `${Math.round(v * 100)} %` }, refreshers));
      body.append(h('button', { class: 'btn ghost', onclick: () => { audio.unlock(); audio.sfx('task'); }, html: `${ICONS.sound}<span>Probar sonido</span>` }));
    } else {
      const keyBtn = h('button', { class: 'btn' }, `Tecla de habilidad: ${p().abilityKey}`);
      keyBtn.addEventListener('click', () => {
        keyBtn.textContent = 'Pulsa una tecla…';
        const on = (e: KeyboardEvent) => { e.preventDefault(); if (/^[a-zA-Z0-9]$/.test(e.key)) set({ abilityKey: e.key.toUpperCase() }); keyBtn.textContent = `Tecla de habilidad: ${p().abilityKey}`; window.removeEventListener('keydown', on, true); };
        window.addEventListener('keydown', on, true);
      });
      const tc = h('div', { class: 'tabs' });
      const renderTc = () => { clear(tc); for (const [id, name] of [['auto', 'Automático'], ['on', 'Siempre'], ['off', 'Nunca']] as const) tc.append(h('button', { class: `tab${p().touch === id ? ' active' : ''}`, onclick: () => { set({ touch: id }); renderTc(); } }, name)); };
      renderTc();
      body.append(keyBtn, h('div', { class: 'field' }, h('label', null, 'Controles táctiles'), tc));
      body.append(h('div', { class: 'howto' },
        tip('Moverse', 'WASD o flechas. En móvil, joystick a la izquierda.'),
        tip('Acciones', 'E usar · V trampilla · X sabotear · T atacar · Q (configurable) habilidad.'),
        tip('Mapa y paneles', 'M o Tab abre el mapa. Escape cierra paneles. Intro abre el chat en reuniones.'),
        tip('Diagnóstico', 'F3 muestra colisiones, contorno, salas y coordenadas (depuración).'),
      ));
    }
  };
  render();
  modal('Ajustes personales', h('div', { class: 'col' }, tabs, body), { wide: true });
}

export function tip(title: string, text: string) {
  return h('div', { class: 'tip' }, h('h4', null, title), h('p', null, text));
}
