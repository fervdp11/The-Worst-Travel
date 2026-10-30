import { getMap } from '../../shared/maps';
import type { GameMode, MapId } from '../../shared/maps/types';
import { ROLES, RoleDef } from '../../shared/roles';
import { effectiveCriticalTime, GAME_FIELDS, GameSettings, KNIFE_PRESETS, knifeParams, RoomSettings, taskTotals, validateSettings } from '../../shared/settings';
import { audio } from '../audio/Audio';
import { Prefs, store } from '../state';
import { clear, h, ICONS, modal } from './dom';
import { mapCards, modeCards } from './MapCards';

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
export function showHostSettings(initialTab: 'partida' | 'mapa' | 'roles' | 'super' = 'partida') {
  const room = store.room;
  if (!room) return;
  const isHost = room.hostId === store.net?.pid;
  const ro = !isHost;
  const refreshers: Refresher[] = [];
  let tab: string = initialTab;
  let roleFilter: 'all' | 'worker' | 'impostor' = 'all';
  const s = () => store.room!.settings;
  const mode = () => store.room!.settings.mode;
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
    const iss = validateSettings(s(), Math.max(humans, 4), getMap(store.room!.mapId));
    document.querySelectorAll('.slider.invalid').forEach((e) => e.classList.remove('invalid'));
    if (!iss.length) return;
    issuesBox.append(h('ul', { class: 'issues' }, iss.map((i) => h('li', null, i.msg))));
    for (const i of iss) document.querySelectorAll(`[data-field^="${i.field.split('.').slice(0, 2).join('.')}"]`).forEach((e) => e.classList.add('invalid'));
  };
  const body = h('div', { class: 'col' });
  const tabs = h('div', { class: 'tabs' });
  const gameField = (key: keyof GameSettings, extra?: { readonly?: boolean; help?: string }) => {
    const f = GAME_FIELDS.find((x) => x.key === key)!;
    let help = extra?.help ?? f.help;
    if (key === 'criticalTime') help += ` Efectivo en ${getMap(store.room!.mapId).texts.short.toLowerCase()}: ${effectiveCriticalTime(s().game, getMap(store.room!.mapId).critTimeScale)} s.`;
    return slider({ label: f.label, min: f.min, max: f.max, step: f.step, unit: f.unit, help, readonly: ro || !!extra?.readonly, fieldKey: `game.${key}`, get: () => s().game[key] as number, set: (v) => { send({ game: { [key]: v } }); refreshTotals(); } }, refreshers);
  };
  const totals = h('div', { class: 'totals small' });
  const refreshTotals = () => {
    const n = Math.max(store.room!.players.filter((p) => p.connected).length, 4);
    const t = taskTotals(s().game, n);
    totals.textContent = `${s().game.shortTasks} cortas + ${s().game.longTasks} larga${s().game.longTasks === 1 ? '' : 's'} por trabajador = ${t.perWorker} tareas cada uno · con ${n} personas (${t.workers} trabajadores): ${t.total} tareas en total. Las reparaciones y las tareas falsas del impostor no cuentan.`;
  };
  const header = () => {
    // Modo y mapa: el modo decide qué controles existen; los incompatibles se ocultan.
    const box = h('div', { class: 'col' });
    const modes = modeCards(mode(), ro ? null : (m: GameMode) => { store.net?.emit('settings', { patch: null, mode: m }); });
    const maps = mapCards(store.room!.mapId, ro || mode() === 'market' ? null : (id: MapId) => { store.net?.emit('settings', { patch: null, mapId: id }); maps.set(id); }, mode());
    box.append(h('div', { class: 'field' }, h('label', null, 'Modo'), modes.el), h('div', { class: 'field' }, h('label', null, 'Mapa'), maps.el));
    return box;
  };
  const render = () => {
    refreshers.length = 0;
    clear(tabs); clear(body);
    const list: [string, string][] = mode() === 'market' ? [['partida', 'PARTIDA'], ['super', 'SUPERMERCADO']] : [['partida', 'PARTIDA'], ['mapa', 'MAPA Y CUCHILLO'], ['roles', 'ESPECIALIDADES']];
    if (!list.some(([id]) => id === tab)) tab = 'partida';
    for (const [id, name] of list) tabs.append(h('button', { class: `tab${tab === id ? ' active' : ''}`, onclick: () => { tab = id; render(); } }, name));
    if (ro) body.append(h('div', { class: 'badge' }, 'Modo lectura: solo el anfitrión puede editar'));
    body.append(issuesBox);
    if (tab === 'partida') {
      body.append(header());
      if (mode() === 'travel') {
        const presetRow = h('div', { class: 'row wrap' }, h('span', { class: 'muted small' }, `Preset de especialidades: ${({ clasico: 'CLÁSICO SIN ROLES', equilibrado: 'EQUILIBRADO', personalizado: 'PERSONALIZADO' } as const)[s().preset]}`));
        if (!ro) for (const [id, name] of [['clasico', 'Restaurar CLÁSICO'], ['equilibrado', 'Restaurar EQUILIBRADO']]) presetRow.append(h('button', { class: 'btn ghost', onclick: () => { store.net?.emit('settings', { patch: { preset: id } }); } }, name));
        body.append(presetRow);
      } else body.append(h('p', { class: 'small muted', style: 'margin:0' }, 'En el Supermercado no hay especialidades ni trampillas: todos tienen la misma información y el mismo tiempo de compra.'));
      const grid = h('div', { class: 'roles-grid' });
      for (const f of GAME_FIELDS.filter((x) => x.tab === 'partida' && x.modes.includes(mode()))) grid.append(gameField(f.key));
      body.append(grid);
      if (mode() === 'travel') { refreshTotals(); body.append(totals); }
      body.append(h('div', { class: 'row wrap', style: 'gap:22px' },
        toggle('Votos anónimos', () => s().game.anonymousVotes, (v) => send({ game: { anonymousVotes: v } }), refreshers, ro),
        toggle('Revelar bando al expulsar', () => s().game.revealTeam, (v) => send({ game: { revealTeam: v } }), refreshers, ro),
        toggle('Permitir SALTAR la votación', () => s().game.allowSkip, (v) => send({ game: { allowSkip: v } }), refreshers, ro),
        mode() === 'travel' ? toggle('Tareas visuales', () => s().game.visualTasks, (v) => send({ game: { visualTasks: v } }), refreshers, ro, 'Desactivado por defecto: evita pruebas automáticas de inocencia.') : null,
      ));
      if (mode() === 'travel') {
        const tb = h('div', { class: 'tabs' });
        const renderTb = () => { clear(tb); for (const [id, name] of [['always', 'Siempre'], ['meetings', 'Al reunirse'], ['never', 'Nunca']] as const) tb.append(h('button', { class: `tab${s().game.taskBarMode === id ? ' active' : ''}`, disabled: ro, onclick: () => { send({ game: { taskBarMode: id } }); renderTb(); } }, name)); };
        renderTb();
        body.append(h('div', { class: 'field' }, h('label', null, 'Actualización de la barra de tareas'), tb));
      }
    } else if (tab === 'super') {
      const grid = h('div', { class: 'roles-grid' });
      for (const f of GAME_FIELDS.filter((x) => x.tab === 'super')) grid.append(gameField(f.key));
      body.append(grid);
      body.append(toggle('Evitar comidas recientes de esta sala', () => s().game.avoidRecentDishes, (v) => send({ game: { avoidRecentDishes: v } }), refreshers, ro));
      body.append(h('p', { class: 'small muted', style: 'margin:0' }, 'La revelación en caja empieza cuando todos han entregado o se agota el tiempo; su duración no resta tiempo de compra. La comida secreta nunca aparece en este resumen.'));
    } else if (tab === 'mapa') {
      // Dificultad del cuchillo: cambia la cadena real (etapas, ayuda y dispersión).
      const kd = h('div', { class: 'tabs' });
      const kdText = h('p', { class: 'small', style: 'margin:0' });
      const renderKd = () => {
        clear(kd);
        for (const id of ['facil', 'normal', 'dificil', 'personalizada'] as const) kd.append(h('button', { class: `tab${s().game.knifeDifficulty === id ? ' active' : ''}`, disabled: ro, onclick: () => { send({ game: { knifeDifficulty: id } }); render(); } }, id === 'personalizada' ? 'PERSONALIZADA' : KNIFE_PRESETS[id].label));
        const d = s().game.knifeDifficulty;
        const kp = knifeParams(s().game);
        kdText.textContent = d === 'personalizada' ? `Personalizada: ${kp.stages} etapas, ayuda ${kp.help}, dispersión ${kp.spread}.` : KNIFE_PRESETS[d].text;
      };
      renderKd();
      body.append(h('div', { class: 'field' }, h('label', null, 'Dificultad para conseguir el cuchillo'), kd, kdText,
        h('span', { class: 'small muted' }, 'Es independiente de la probabilidad de recibir una especialidad de impostor. No cambia las condiciones de victoria ni la duración de los sabotajes.')));
      const custom = s().game.knifeDifficulty !== 'personalizada';
      const kgrid = h('div', { class: 'roles-grid' });
      for (const k of ['knifeStages', 'knifeHelp', 'knifeSpread'] as const) kgrid.append(gameField(k, { readonly: custom, help: custom ? 'Elige PERSONALIZADA para ajustarlo.' : undefined }));
      body.append(kgrid);
      body.append(h('p', { class: 'small muted', style: 'margin:0' }, 'Sabotajes, trampillas y taquillas del vehículo (los plazos críticos se ajustan a sus distancias):'));
      const grid = h('div', { class: 'roles-grid' });
      for (const f of GAME_FIELDS.filter((x) => x.tab === 'mapa' && !x.key.startsWith('knife'))) grid.append(gameField(f.key));
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
  let lastMode = mode(), lastMap = store.room!.mapId;
  const off = store.on('room', () => {
    if (!store.room) { m.close(); return; }
    if (pending) return;
    if (store.room.settings.mode !== lastMode || store.room.mapId !== lastMap) { lastMode = store.room.settings.mode; lastMap = store.room.mapId; render(); return; }
    for (const r of refreshers) r();
    refreshTotals();
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
        tip('Depuración', 'F3: contorno visual (blanco), colisión (verde), oclusión de visión (magenta), sombra (azul), muros y puertas.'),
      ));
    }
  };
  render();
  modal('Ajustes personales', h('div', { class: 'col' }, tabs, body), { wide: true });
}

export function tip(title: string, text: string) {
  return h('div', { class: 'tip' }, h('h4', null, title), h('p', null, text));
}
