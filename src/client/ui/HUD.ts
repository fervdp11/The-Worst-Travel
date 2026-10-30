import { getMap } from '../../shared/maps';
import type { MapDef } from '../../shared/maps/types';
import { PRODUCT_BY_ID } from '../../shared/market';
import { ROLE_BY_ID } from '../../shared/roles';
import { audio } from '../audio/Audio';
import { store } from '../state';
import type { App } from './App';
import { clear, fmtSecs, h, ICONS, productIcon, toast, uiRoot } from './dom';
import { openMap, MiniMap } from './MapView';
import { abilityDialog } from './Panels';

interface ActBtn { el: HTMLButtonElement; cd: HTMLElement; uses: HTMLElement; label: HTMLElement }

/**
 * HUD de exploración con zonas reservadas que nunca se solapan:
 *  - columna izquierda: tareas (o compra) y, debajo, objetivos privados del impostor;
 *  - abajo a la izquierda: botón de mapa y minimapa;
 *  - arriba a la derecha: sala actual y temporizadores;
 *  - centro superior: alertas; abajo a la derecha: acciones.
 */
export class HUD {
  root: HTMLElement;
  private def: MapDef;
  private tasksBox: HTMLElement;
  private tasksList: HTMLElement;
  private progress: HTMLElement;
  private totals = h('span', { class: 'small muted' });
  private zoneRoom = h('div', { class: 'room' });
  private zoneSub = h('div', { class: 'lvl' });
  private zoneTimer = h('div', { class: 'ztimer hidden' });
  private alarm = h('div', { class: 'panel alarm hidden', role: 'status', 'aria-live': 'polite' });
  private vignette = h('div', { class: 'vignette hidden' });
  private arrival = h('div', { class: 'panel arrival hidden' });
  private impPanel = h('div', { class: 'panel imp-panel hidden', 'aria-label': 'Objetivo secreto' });
  private marketPanel = h('div', { class: 'panel market-panel hidden' });
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
  private lastKnifeStage = -1;
  private lastTick = -1;

  constructor(private app: App) {
    this.def = getMap(store.gstart!.mapId);
    this.progress = h('i', { style: 'width:0%' });
    this.tasksList = h('ul');
    this.tasksBox = h('div', { class: 'panel tasks' },
      h('div', { class: 'head', onclick: () => { this.collapsed = !this.collapsed; this.tasksBox.classList.toggle('collapsed', this.collapsed); } }, h('span', { html: ICONS.task, style: 'display:inline-flex;width:22px' }), h('span', { class: 'grow' }, 'Tareas'), this.totals, h('span', { class: 'small muted' }, '▾')),
      h('div', { class: 'progress', title: 'Progreso colectivo de tareas' }, this.progress),
      this.tasksList,
    );
    const mk = (id: string, icon: string, label: string, cls: string, on: () => void): HTMLButtonElement => {
      const cd = h('div', { class: 'cd hidden' });
      const uses = h('div', { class: 'uses' });
      const lab = h('span', null, label);
      const el = h('button', { class: `btn act ${cls}`, onclick: () => { audio.unlock(); on(); }, title: label, 'aria-label': label }, h('span', { html: ICONS[icon] }), lab, cd, uses) as HTMLButtonElement;
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
    const left = h('div', { class: 'hud-left' }, h('button', { class: 'btn act', onclick: () => this.openMapView(), title: 'Mapa (M)', html: `${ICONS.map}<span>MAPA</span>` }), this.mini.el);
    const market = store.gstart?.mapId === 'market';
    const col = h('div', { class: 'hud-col scroll' }, market ? this.marketPanel : this.tasksBox, this.impPanel);
    this.root = h('div', { class: 'screen', style: 'pointer-events:none' },
      this.vignette,
      col,
      h('div', { class: 'panel zone' }, this.zoneRoom, this.zoneSub, this.zoneTimer),
      this.alarm, this.arrival, this.prompt, actions, left, this.diag,
    );
    uiRoot().append(this.root);
    this.offs.push(store.on('priv', () => this.renderPriv()));
    this.offs.push(store.on('pub', () => { this.renderPub(); this.renderPriv(); }));
    this.renderPriv();
    this.renderPub();
    const loop = () => { this.frame(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  /** Mapa ampliado con el objetivo actual en un panel lateral propio. */
  private openMapView() {
    openMap(this.app, () => {
      const p = store.priv;
      if (store.pub?.mode === 'market') return this.marketSummary(true);
      if (p?.team === 'impostor' && p.knife) return this.knifeList(true);
      return null;
    });
  }

  private renderPriv() {
    const p = store.priv;
    if (!p) return;
    if (store.pub?.mode === 'market') { this.renderMarket(); return; }
    clear(this.tasksList);
    const isImp = p.team === 'impostor';
    if (isImp) this.tasksList.append(h('li', { style: 'color:#ff8b95;font-weight:900' }, 'Tareas aparentes (no suman progreso)'));
    const real = p.tasks.filter((t) => !t.fake);
    this.totals.textContent = isImp ? '' : `${real.filter((t) => t.done).length}/${real.length}`;
    for (const t of p.tasks) {
      this.tasksList.append(h('li', { class: t.done ? 'done' : '' },
        h('span', null, t.done ? '✔' : t.length === 'long' ? '◆' : '•'),
        h('span', null, h('b', null, t.name), t.done ? null : h('span', { class: 'muted' }, ` — ${t.label}${t.stages > 1 ? ` (${t.stage + 1}/${t.stages})` : ''}`)),
      ));
    }
    if (p.carrying) this.tasksList.append(h('li', { style: 'color:var(--gold)' }, 'Llevas una bandeja'));
    // Panel privado del impostor: objetivo final, paso actual numerado e instrucción concreta.
    if (isImp && p.knife) {
      clear(this.impPanel);
      this.impPanel.classList.remove('hidden');
      // Para el impostor, su objetivo real va primero; las tareas aparentes, debajo.
      this.impPanel.style.order = '-1';
      this.impPanel.append(this.knifeList(false));
      if (this.lastKnifeStage !== -1 && p.knife.stage > this.lastKnifeStage) { this.impPanel.classList.remove('pulse'); void this.impPanel.offsetWidth; this.impPanel.classList.add('pulse'); }
      this.lastKnifeStage = p.knife.stage;
    } else this.impPanel.classList.add('hidden');
  }

  /** Lista de pasos del arma (también se usa en el panel lateral del mapa ampliado). */
  private knifeList(compact: boolean): HTMLElement {
    const k = store.priv!.knife!;
    const resp = store.priv!.responsible;
    const done = k.steps.filter((s) => s.state === 'done').length;
    const pct = Math.round((Math.min(done, k.total) / k.total) * 100);
    const box = h('div', { class: `knife-list${compact ? ' compact' : ''}` },
      h('h4', null, 'Objetivo secreto'),
      h('div', { class: 'small' }, `Final: atacar a ${resp ? `${resp.title.toLowerCase()} (${resp.name})` : 'el responsable'} con el cuchillo.`),
      h('div', { class: 'progress small-bar', title: `Preparación ${pct} %` }, h('i', { style: `width:${pct}%` })),
      h('ol', null, this.knifeRows(k.steps)),
      h('div', { class: 'clue' }, k.clue),
    );
    if (k.codeParts.length) box.append(h('div', { class: 'code' }, `Combinación: ${k.codeParts.join(' · ')}`));
    box.append(h('div', { class: 'small muted' }, k.hasKnife ? (k.authorized ? 'Arma oculta y acceso listo: acércate y mantén ATACAR.' : 'Arma oculta. Falta el último requisito.') : `Preparación: ${done}/${k.total} etapas.`));
    return box;
  }

  /** Filas de la cadena: las etapas bloqueadas intermedias se agrupan en una sola línea para no tapar el HUD. */
  private knifeRows(steps: { label: string; state: string }[]): HTMLElement[] {
    const rows: HTMLElement[] = [];
    const row = (state: string, n: string, label: HTMLElement | string) => h('li', { class: state }, h('span', { class: 'n' }, n), h('span', null, label));
    let i = 0;
    while (i < steps.length) {
      const s = steps[i];
      const last = i === steps.length - 1;
      if (s.state === 'locked' && !last) {
        let j = i;
        while (j + 1 < steps.length - 1 && steps[j + 1].state === 'locked') j++;
        rows.push(row('locked', '🔒', j > i ? `Etapas ${i + 1}–${j + 1}: se desbloquean en orden` : s.label));
        i = j + 1;
        continue;
      }
      rows.push(row(s.state, s.state === 'done' ? '✔' : s.state === 'locked' ? '🔒' : String(i + 1), s.state === 'current' ? h('b', null, s.label) : s.label));
      i++;
    }
    return rows;
  }

  private marketSummary(compact: boolean): HTMLElement {
    const m = store.priv?.market;
    const box = h('div', { class: `market-sum${compact ? ' compact' : ''}` });
    if (!m) return box;
    if (m.dish) box.append(h('div', { class: 'dish' }, h('span', { class: 'small muted' }, 'Comida'), h('b', null, m.dish)));
    else box.append(h('div', { class: 'dish imp' }, h('span', { class: 'small' }, 'No conoces la comida'), h('b', null, 'Dedúcela')));
    box.append(h('div', { class: 'small' }, m.objective));
    return box;
  }

  private renderMarket() {
    const m = store.priv?.market;
    const pub = store.pub;
    clear(this.marketPanel);
    this.marketPanel.classList.remove('hidden');
    if (!m || !pub?.market) return;
    this.marketPanel.append(this.marketSummary(false));
    const carry = m.carrying ? PRODUCT_BY_ID[m.carrying] : null;
    this.marketPanel.append(h('div', { class: 'carry' },
      carry ? productIcon(carry.id, 34) : h('span', { class: 'empty-bag', html: ICONS.cart }),
      h('div', null, h('div', { class: 'small muted' }, m.delivered ? 'Compra entregada' : 'En la mano'), h('b', null, m.delivered ? 'Bolsa sellada en caja' : carry ? carry.name : 'Nada todavía'))));
    if (m.used.length) this.marketPanel.append(h('div', { class: 'small muted' }, `Ya aportaste: ${m.used.map((id) => PRODUCT_BY_ID[id]?.name ?? id).join(', ')} (no puedes repetirlos).`));
    const mk = pub.market;
    this.marketPanel.append(h('div', { class: 'small' }, `Ronda ${mk.round} · entregas ${mk.delivered.length}/${mk.expected.length}`));
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
    const rname = pub.mode === 'market' ? this.sectionAt(pos.x, pos.y) : room?.name ?? '';
    if (this.zoneRoom.textContent !== rname) this.zoneRoom.textContent = rname;
    const sub = `${this.def.texts.short} · ${this.def.texts.vehicle}`;
    if (this.zoneSub.textContent !== sub) this.zoneSub.textContent = sub;
    const alive = w.pos.st !== 'ghost';
    const exploring = pub.phase === 'EXPLORACION' || pub.phase === 'COMPRA';
    const it = w.interact;
    const isImp = priv.team === 'impostor';
    // Temporizador de fase (supermercado): deriva del plazo del servidor, nunca se reinicia aquí.
    if (pub.mode === 'market' && pub.phase === 'COMPRA' && pub.phaseEnds) {
      const left = store.secsLeft(pub.phaseEnds);
      this.zoneTimer.classList.remove('hidden');
      const txt = `Compra: ${fmtSecs(left)}`;
      if (this.zoneTimer.textContent !== txt) this.zoneTimer.textContent = txt;
      this.zoneTimer.classList.toggle('warn', left <= 10);
      if (left <= 5 && left > 0 && left !== this.lastTick) { this.lastTick = left; audio.sfx('tick'); }
    } else this.zoneTimer.classList.add('hidden');
    // Sabotajes y alarmas (solo Viaje)
    const sab = pub.sabotage;
    if (sab && exploring) {
      this.alarm.classList.remove('hidden');
      const left = sab.endsGt !== null ? sab.endsGt - gt : null;
      const key = `${sab.id}|${sab.step}|${left !== null}`;
      if (key !== this.alarmKey) {
        this.alarmKey = key;
        clear(this.alarm);
        this.alarmTimer = h('div', { class: 't' });
        const parts: Node[] = [h('div', { class: 'row', style: 'justify-content:center' }, h('span', { html: ICONS.alarm, style: 'display:inline-flex;width:26px;color:var(--bad)' }), h('h3', null, sab.kind === 'critical' ? `¡AVERÍA CRÍTICA! ${sab.name}` : `Sabotaje: ${sab.name}`))];
        if (left !== null) parts.push(this.alarmTimer);
        if (sab.kind === 'doors') parts.push(h('div', { class: 'steps' }, 'Puertas cerradas temporalmente. Usa la apertura de seguridad junto a una puerta o espera.'));
        if (sab.steps.length) parts.push(h('div', { class: 'steps' }, sab.steps.map((s, i) => h('div', { class: i < sab.step ? 'ok' : i === sab.step ? 'on' : '' }, `${i + 1}. ${s.label}`))));
        this.alarm.append(...parts);
        this.alarm.style.borderColor = sab.kind === 'critical' ? 'var(--bad)' : 'var(--gold)';
      }
      if (left !== null) { const txt = fmtSecs(Math.max(0, Math.ceil(left / 1000))); if (this.alarmTimer.textContent !== txt) this.alarmTimer.textContent = txt; }
      this.vignette.classList.toggle('hidden', !store.prefs.effects || sab.kind === 'doors');
      this.vignette.classList.toggle('soft', sab.kind !== 'critical');
    } else { this.alarmKey = ''; this.alarm.classList.add('hidden'); this.vignette.classList.add('hidden'); }
    if (pub.arrival && exploring) {
      this.arrival.classList.remove('hidden');
      this.arrival.textContent = pub.arrival.paused ? `${this.def.texts.approach}: en pausa por la avería crítica` : `${this.def.texts.approach}: ${fmtSecs(Math.max(0, Math.ceil((pub.arrival.endsGt - gt) / 1000)))}`;
      this.arrival.style.top = sab ? '190px' : '76px';
    } else this.arrival.classList.add('hidden');
    // Botones contextuales con verbo claro
    const show = (id: string, vis: boolean, enabled = true) => { const b = this.btn[id]; b.el.classList.toggle('hidden', !vis); b.el.disabled = !enabled; };
    const useKinds = ['use', 'emergency', 'door', 'shelf', 'checkout'];
    const canUse = exploring && useKinds.includes(it.kind);
    show('use', true, canUse);
    const verb = (canUse ? it.verb : '') || (pub.mode === 'market' ? 'Recoger' : 'Usar');
    if (this.btn.use.label.textContent !== verb.toUpperCase()) this.btn.use.label.textContent = verb.toUpperCase();
    this.btn.use.el.classList.toggle('hl', canUse);
    show('hide', alive && exploring && pub.mode === 'travel' && (it.kind === 'locker' || w.pos.st === 'locker'), true);
    this.btn.hide.label.textContent = w.pos.st === 'locker' ? 'SALIR' : 'OCULTARSE';
    const ventAllowed = alive && pub.mode === 'travel' && (isImp || priv.role === 'ingeniero');
    show('vent', ventAllowed, exploring && (!!it.ventNear || w.pos.st === 'vent') && gt >= priv.ventCooldownGt);
    this.btn.vent.label.textContent = w.pos.st === 'vent' ? 'SALIR' : 'TRAMPILLA';
    this.cooldown('vent', priv.ventCooldownGt - gt);
    show('sabotage', alive && pub.mode === 'travel' && (isImp || !!store.room?.practice), exploring && !!it.sabotageStation && !sab && gt >= pub.sabotageReadyGt);
    this.cooldown('sabotage', it.sabotageStation ? pub.sabotageReadyGt - gt : 0);
    show('attack', alive && isImp && !!priv.knife?.hasKnife && !!priv.knife?.authorized, exploring && it.respNear);
    const ab = priv.ability;
    const hasAbility = alive && pub.mode === 'travel' && !!ab && !ab.passive && priv.role !== 'ingeniero';
    show('ability', hasAbility, exploring);
    if (ab && hasAbility) {
      this.btn.ability.label.textContent = ROLE_BY_ID[ab.role].name.toUpperCase();
      this.cooldown('ability', ab.cooldownEndsGt - gt, ab.activeEndsGt > gt ? ab.activeEndsGt - gt : 0);
      this.btn.ability.uses.textContent = ab.uses !== null ? `×${ab.uses}` : ab.battery !== undefined ? `${ab.battery.toFixed(0)} s` : '';
    }
    // Indicación de interacción: etiqueta breve con el verbo de la acción disponible.
    if (exploring && it.kind !== 'none' && it.label) {
      this.prompt.classList.remove('hidden');
      const key = it.kind === 'vent' ? 'V' : it.kind === 'sabotage' ? 'X' : 'E';
      const html = `<kbd>${key}</kbd><b>${it.verb}</b> · ${escapeHtml(it.label)}`;
      if (this.prompt.innerHTML !== html) this.prompt.innerHTML = html;
      this.prompt.classList.toggle('red', it.color === 0xff3b4f);
    } else this.prompt.classList.add('hidden');
    // Diagnóstico
    if (store.prefs.diagnostics) {
      const now = performance.now();
      if (now - this.lastDiag > 250) {
        this.lastDiag = now;
        const net = store.net;
        this.diag.classList.remove('hidden');
        this.diag.textContent = `FPS ${w.fps.toFixed(0)} · ${w.frameMs.toFixed(1)} ms (pico ${w.frameMax.toFixed(0)} ms) · ping ${net ? Math.round(net.rtt) : 0} ms · jitter ${net ? net.jitter.toFixed(0) : 0} · entidades ${w.ents.size} · red ${net?.status ?? '-'} · (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`;
      }
    } else this.diag.classList.add('hidden');
    this.mini.draw();
  }

  private sectionAt(x: number, y: number): string {
    const secs = this.def.market?.sections ?? [];
    for (const s of secs) if (x >= s.rect.x && x <= s.rect.x + s.rect.w && y >= s.rect.y && y <= s.rect.y + s.rect.h) return s.name;
    return this.app.world.rt?.roomAt(this.app.world.pos.level, x, y)?.name ?? '';
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
    const ph = store.pub?.phase;
    if (ph !== 'EXPLORACION' && ph !== 'COMPRA') return;
    if (it.kind === 'door' && it.doorId) { store.net?.act({ k: 'use', st: `door:${it.doorId}` }); w.freeze(200); return; }
    if (!it.station) { toast('No hay nada que usar aquí.', 'info', 1200); return; }
    if (it.kind === 'sabotage') { this.sabotage(); return; }
    if (it.kind === 'vent') { this.vent(); return; }
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
    if (k === 'm' || k === 'tab') { e.preventDefault(); this.openMapView(); return; }
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
