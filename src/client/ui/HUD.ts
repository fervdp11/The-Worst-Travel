import { getMap } from '../../shared/maps';
import type { MapDef } from '../../shared/maps/types';
import { ROLE_BY_ID } from '../../shared/roles';
import { audio } from '../audio/Audio';
import { store } from '../state';
import type { App } from './App';
import { clear, fmtTime, h, ICONS, toast, uiRoot } from './dom';
import { openMap, MiniMap } from './MapView';
import { abilityDialog } from './Panels';

interface ActBtn { el: HTMLButtonElement; cd: HTMLElement; uses: HTMLElement; label: HTMLElement }

/** HUD de exploración: limpio, con señales que no dependen solo del color. */
export class HUD {
  root: HTMLElement;
  private def: MapDef;
  private tasksBox: HTMLElement;
  private tasksList: HTMLElement;
  private progress: HTMLElement;
  private zoneRoom = h('div', { class: 'room' });
  private zoneLvl = h('div', { class: 'lvl' });
  private alarm = h('div', { class: 'panel alarm hidden' });
  private vignette = h('div', { class: 'vignette hidden' });
  private arrival = h('div', { class: 'panel arrival hidden' });
  private impPanel = h('div', { class: 'panel imp-panel hidden' });
  private prompt = h('div', { class: 'prompt hidden' });
  private diag = h('div', { class: 'diag hidden' });
  private btn: Record<string, ActBtn> = {};
  private offs: (() => void)[] = [];
  private raf = 0;
  private collapsed = false;
  private mini: MiniMap;
  private lastDiag = 0;
  private alarmKey = '';
  private alarmTimer: HTMLElement = h('div');

  constructor(private app: App) {
    this.def = getMap(store.gstart!.mapId);
    this.progress = h('i', { style: 'width:0%' });
    this.tasksList = h('ul');
    this.tasksBox = h('div', { class: 'panel tasks' },
      h('div', { class: 'head', onclick: () => { this.collapsed = !this.collapsed; this.tasksBox.classList.toggle('collapsed', this.collapsed); } }, h('span', { html: ICONS.task, style: 'display:inline-flex;width:22px' }), h('span', { class: 'grow' }, 'Tareas'), h('span', { class: 'small muted' }, '▾')),
      h('div', { class: 'progress', title: 'Progreso colectivo de tareas' }, this.progress),
      this.tasksList,
    );
    const mk = (id: string, icon: string, label: string, cls: string, on: () => void): HTMLButtonElement => {
      const cd = h('div', { class: 'cd hidden' });
      const uses = h('div', { class: 'uses' });
      const lab = h('span', null, label);
      const el = h('button', { class: `btn act ${cls}`, onclick: () => { audio.unlock(); on(); }, title: label }, h('span', { html: ICONS[icon] }), lab, cd, uses) as HTMLButtonElement;
      this.btn[id] = { el, cd, uses, label: lab };
      return el;
    };
    const actions = h('div', { class: 'hud-actions' },
      mk('sabotage', 'sabotage', 'SABOTEAR', 'danger', () => this.sabotage()),
      mk('vent', 'vent', 'TRAMPILLA', 'ok', () => this.vent()),
      mk('ability', 'bolt', 'HABILIDAD', 'info', () => this.ability()),
      mk('attack', 'attack', 'ATACAR', 'danger', () => this.attack()),
      mk('hide', 'locker', 'OCULTARSE', '', () => this.use()),
      mk('use', 'hand', 'USAR', 'primary', () => this.use()),
    );
    this.mini = new MiniMap(app);
    const left = h('div', { class: 'hud-left' }, h('button', { class: 'btn act', onclick: () => openMap(this.app), title: 'Mapa (M)', html: `${ICONS.map}<span>MAPA</span>` }), this.mini.el);
    this.root = h('div', { class: 'screen', style: 'pointer-events:none' },
      this.vignette,
      h('div', { class: 'hud-top' }, this.tasksBox, h('div', { class: 'panel zone' }, this.zoneRoom, this.zoneLvl)),
      this.alarm, this.arrival, this.impPanel, this.prompt, actions, left, this.diag,
    );
    uiRoot().append(this.root);
    this.offs.push(store.on('priv', () => this.renderPriv()));
    this.offs.push(store.on('pub', () => this.renderPub()));
    this.renderPriv();
    this.renderPub();
    const loop = () => { this.frame(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  private levelName(id: string) { return this.def.levels.find((l) => l.id === id)?.name ?? id; }

  private renderPriv() {
    const p = store.priv;
    if (!p) return;
    clear(this.tasksList);
    const isImp = p.team === 'impostor';
    if (isImp) this.tasksList.append(h('li', { style: 'color:#ff8b95;font-weight:900' }, 'Tareas aparentes (no suman progreso)'));
    for (const t of p.tasks) {
      this.tasksList.append(h('li', { class: t.done ? 'done' : '' },
        h('span', null, t.done ? '✔' : t.length === 'long' ? '◆' : '•'),
        h('span', null, h('b', null, t.name), t.done ? null : h('span', { class: 'muted' }, ` — ${t.label}${t.stages > 1 ? ` (${t.stage + 1}/${t.stages})` : ''}`)),
        t.done ? null : h('span', { class: 'lvl' }, this.levelName(t.level)),
      ));
    }
    if (p.carrying) this.tasksList.append(h('li', { style: 'color:var(--gold)' }, '🍽 Llevas una bandeja'));
    // Panel privado del impostor
    if (isImp && p.knife) {
      const k = p.knife;
      clear(this.impPanel);
      this.impPanel.classList.remove('hidden');
      this.impPanel.append(h('h4', null, `Objetivo secreto · etapa ${Math.min(5, k.stage + 1)}/5`), h('div', { class: 'clue' }, h('b', null, k.objective), h('br'), k.clue));
      if (k.codeParts.length) this.impPanel.append(h('div', { class: 'code' }, `Código: ${k.codeParts.join('')}${'·'.repeat(4 - k.codeParts.join('').length)}`));
      this.impPanel.append(h('div', { class: 'small muted' }, `${k.hasKnife ? '🔪 Arma oculta. ' : ''}${k.authorized ? 'Autorización lista.' : ''}`));
    } else this.impPanel.classList.add('hidden');
  }

  private renderPub() {
    const pub = store.pub;
    if (!pub) return;
    const pct = pub.taskProgress === null ? null : Math.round(pub.taskProgress * 100);
    this.progress.style.width = `${pct ?? 0}%`;
    this.progress.parentElement!.title = pct === null ? 'La barra de tareas está oculta' : `Progreso colectivo: ${pct} %${pub.phase === 'EXPLORACION' && store.room?.settings.game.taskBarMode === 'meetings' ? ' (se actualiza en reuniones)' : ''}`;
    this.progress.parentElement!.classList.toggle('hidden', pct === null);
  }

  private frame() {
    const pub = store.pub, priv = store.priv, w = this.app.world;
    if (!pub || !priv || !w) return;
    const gt = store.gtNow();
    const pos = w.myPos();
    const room = w.rt?.roomAt(pos.level, pos.x, pos.y);
    const rname = room?.name ?? '';
    if (this.zoneRoom.textContent !== rname) this.zoneRoom.textContent = rname;
    const lvl = `${this.def.texts.short} · Nivel ${this.levelName(pos.level)}`;
    if (this.zoneLvl.textContent !== lvl) this.zoneLvl.textContent = lvl;
    const alive = w.pos.st !== 'ghost';
    const exploring = pub.phase === 'EXPLORACION';
    const it = w.interact;
    const isImp = priv.team === 'impostor';
    // Sabotajes y alarmas
    const sab = pub.sabotage;
    if (sab && exploring) {
      this.alarm.classList.remove('hidden');
      const left = sab.endsGt !== null ? sab.endsGt - gt : null;
      const key = `${sab.id}|${sab.step}|${pos.level}|${left !== null}`;
      if (key !== this.alarmKey) {
        this.alarmKey = key;
        clear(this.alarm);
        this.alarmTimer = h('div', { class: 't' });
        const parts: Node[] = [h('div', { class: 'row', style: 'justify-content:center' }, h('span', { html: ICONS.alarm, style: 'display:inline-flex;width:26px;color:var(--bad)' }), h('h3', null, sab.kind === 'critical' ? `¡AVERÍA CRÍTICA! ${sab.name}` : `Sabotaje: ${sab.name}`))];
        if (left !== null) parts.push(this.alarmTimer);
        if (sab.kind === 'doors') parts.push(h('div', { class: 'steps' }, 'Puertas cerradas temporalmente. Usa la apertura de seguridad junto a una puerta o espera.'));
        if (sab.steps.length) parts.push(h('div', { class: 'steps' }, sab.steps.map((s, i) => h('div', { class: i < sab.step ? 'ok' : i === sab.step ? 'on' : '' }, `${i + 1}. ${s.label} — nivel ${this.levelName(s.level)}${i === sab.step && s.level !== pos.level ? (this.isAbove(s.level, pos.level) ? ' ⬆' : ' ⬇') : ''}`))));
        this.alarm.append(...parts);
        this.alarm.style.borderColor = sab.kind === 'critical' ? 'var(--bad)' : 'var(--gold)';
      }
      if (left !== null) { const txt = fmtTime(left); if (this.alarmTimer.textContent !== txt) this.alarmTimer.textContent = txt; }
      this.vignette.classList.toggle('hidden', !store.prefs.effects || sab.kind === 'doors');
      this.vignette.classList.toggle('soft', sab.kind !== 'critical');
    } else { this.alarmKey = ''; this.alarm.classList.add('hidden'); this.vignette.classList.add('hidden'); }
    if (pub.arrival && exploring) {
      this.arrival.classList.remove('hidden');
      this.arrival.textContent = pub.arrival.paused ? `${this.def.texts.approach}: en pausa por la avería crítica` : `${this.def.texts.approach}: ${fmtTime(pub.arrival.endsGt - gt)}`;
      this.arrival.style.top = sab ? '190px' : '76px';
    } else this.arrival.classList.add('hidden');
    // Botones contextuales
    const show = (id: string, vis: boolean, enabled = true) => { const b = this.btn[id]; b.el.classList.toggle('hidden', !vis); b.el.disabled = !enabled; };
    const useKinds = ['use', 'emergency', 'ladder', 'door'];
    const canUse = exploring && useKinds.includes(it.kind);
    show('use', true, canUse);
    this.btn.use.label.textContent = it.kind === 'emergency' ? 'REUNIÓN' : it.kind === 'ladder' ? (w.pos.level === it.station?.level ? 'ESCALERA' : 'USAR') : it.kind === 'door' ? 'ABRIR' : 'USAR';
    this.btn.use.el.classList.toggle('hl', canUse);
    show('hide', alive && exploring && (it.kind === 'locker' || w.pos.st === 'locker'), true);
    this.btn.hide.label.textContent = w.pos.st === 'locker' ? 'SALIR' : 'OCULTARSE';
    const ventAllowed = alive && (isImp || priv.role === 'ingeniero');
    show('vent', ventAllowed, exploring && (!!it.ventNear || w.pos.st === 'vent') && gt >= priv.ventCooldownGt);
    this.cooldown('vent', priv.ventCooldownGt - gt);
    show('sabotage', alive && (isImp || !!store.room?.practice), exploring && !!it.sabotageStation && !sab && gt >= pub.sabotageReadyGt);
    this.cooldown('sabotage', it.sabotageStation ? pub.sabotageReadyGt - gt : 0);
    show('attack', alive && isImp && !!priv.knife?.hasKnife && !!priv.knife?.authorized, exploring && it.respNear);
    const ab = priv.ability;
    const hasAbility = alive && !!ab && !ab.passive && priv.role !== 'ingeniero';
    show('ability', hasAbility, exploring);
    if (ab && hasAbility) {
      this.btn.ability.label.textContent = ROLE_BY_ID[ab.role].name.toUpperCase();
      this.cooldown('ability', ab.cooldownEndsGt - gt, ab.activeEndsGt > gt ? ab.activeEndsGt - gt : 0);
      this.btn.ability.uses.textContent = ab.uses !== null ? `×${ab.uses}` : ab.battery !== undefined ? `${ab.battery.toFixed(0)} s` : '';
    }
    // Indicación de interacción
    if (exploring && it.kind !== 'none' && it.label) {
      this.prompt.classList.remove('hidden');
      const key = it.kind === 'vent' ? 'V' : 'E';
      this.prompt.innerHTML = `<kbd>${key}</kbd>${it.label}`;
    } else if (exploring && it.sabotageStation) {
      this.prompt.classList.remove('hidden');
      this.prompt.innerHTML = `<kbd>X</kbd>Sabotear: ${w.rt?.stations.get(it.sabotageStation)?.name ?? ''}`;
    } else this.prompt.classList.add('hidden');
    // Diagnóstico
    if (store.prefs.diagnostics) {
      const now = performance.now();
      if (now - this.lastDiag > 250) {
        this.lastDiag = now;
        const net = store.net;
        this.diag.classList.remove('hidden');
        this.diag.textContent = `FPS ${w.fps.toFixed(0)} · ${w.frameMs.toFixed(1)} ms · ping ${net ? Math.round(net.rtt) : 0} ms · jitter ${net ? net.jitter.toFixed(0) : 0} · entidades ${w.ents.size} · red ${net?.status ?? '-'} · ${pos.level} (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`;
      }
    } else this.diag.classList.add('hidden');
    this.mini.draw();
  }

  private isAbove(target: string, cur: string) {
    const a = this.def.levels.find((l) => l.id === target)?.index ?? 0;
    const b = this.def.levels.find((l) => l.id === cur)?.index ?? 0;
    return a > b;
  }

  private cooldown(id: string, leftMs: number, activeMs = 0) {
    const b = this.btn[id];
    if (activeMs > 0) { b.cd.classList.remove('hidden'); b.cd.textContent = `▶${Math.ceil(activeMs / 1000)}`; b.cd.style.color = 'var(--ok)'; return; }
    b.cd.style.color = '';
    if (leftMs > 0) { b.cd.classList.remove('hidden'); b.cd.textContent = String(Math.ceil(leftMs / 1000)); }
    else b.cd.classList.add('hidden');
  }

  use() {
    const w = this.app.world;
    const it = w.interact;
    if (w.pos.st === 'locker') { store.net?.act({ k: 'leaveLocker' }); return; }
    if (store.pub?.phase !== 'EXPLORACION') return;
    if (it.kind === 'door' && it.doorId) { store.net?.act({ k: 'use', st: `door:${it.doorId}` }); w.freeze(200); return; }
    if (!it.station) { if (!it.sabotageStation) toast('No hay nada que usar aquí.', 'info', 1200); return; }
    audio.sfx('open');
    store.net?.act({ k: 'use', st: it.station.id });
    w.freeze(180 + (store.net?.rtt ?? 0));
  }

  private vent() {
    const w = this.app.world;
    if (w.pos.st === 'vent') { store.net?.act({ k: 'vent', exit: true }); return; }
    if (w.interact.ventNear) { store.net?.act({ k: 'use', st: w.interact.ventNear }); w.freeze(300); }
  }

  private sabotage() {
    const st = this.app.world.interact.sabotageStation;
    if (!st) { toast('Debes estar en una instalación saboteable (consulta tu mapa).', 'warn'); return; }
    store.net?.act({ k: 'use', st });
  }

  private attack() {
    store.net?.act({ k: 'attack' });
    this.app.world.freeze(400);
  }

  private ability() {
    const priv = store.priv;
    if (!priv?.ability) return;
    const r = priv.ability.role;
    if (r === 'rastreador' || r === 'camuflador' || r === 'observador') { abilityDialog(this.app, r); return; }
    store.net?.act({ k: 'ability' });
  }

  onKey(k: string, e: KeyboardEvent) {
    if (store.view !== 'game') return;
    if (k === 'm' || k === 'tab') { e.preventDefault(); openMap(this.app); return; }
    if (k === 'e') this.use();
    else if (k === 'v') this.vent();
    else if (k === 'x') this.sabotage();
    else if (k === 't') this.attack();
    else if (k === store.prefs.abilityKey.toLowerCase()) this.ability();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    for (const o of this.offs) o();
    this.mini.destroy();
    this.root.remove();
  }
}
