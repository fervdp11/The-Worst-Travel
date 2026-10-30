import { USE_RANGE } from '../../shared/constants';
import { dist } from '../../shared/geometry';
import type { AbilityPrivate, AnalystData, ClientAction } from '../../shared/protocol';
import { randomId } from '../../shared/rng';
import { ROLE_BY_ID } from '../../shared/roles';
import type { RoomSettings } from '../../shared/settings';
import type { Game } from './Game';
import { fxAround } from './interactions';
import type { GPlayer } from './types';
import { camJammed, hiddenFromOthers } from './visibility';

export function abilityRoleParam(g: Game, p: GPlayer, key: string): number | undefined {
  if (!p.role) return undefined;
  return g.settingsAll.roles[p.role]?.params[key];
}

export function initAbility(g: Game, p: GPlayer, s: RoomSettings) {
  if (!p.role) return;
  const params = s.roles[p.role].params;
  p.abilityUses = params.uses ?? 0;
  p.battery = (params.battery ?? 0) * 1000;
  void g;
}

export function abilityPrivate(g: Game, p: GPlayer): AbilityPrivate | null {
  if (!p.role) return null;
  const def = ROLE_BY_ID[p.role];
  const params = g.settingsAll.roles[p.role].params;
  return {
    role: p.role,
    cooldownEndsGt: p.abilityCooldownGt,
    activeEndsGt: p.activeEndsGt,
    uses: 'uses' in params ? p.abilityUses : null,
    battery: p.role === 'analista' ? p.battery / 1000 : undefined,
    maxBattery: p.role === 'analista' ? params.battery : undefined,
    target: p.tracker?.target ? undefined : undefined,
    passive: !!def.passive,
  };
}

function ready(g: Game, p: GPlayer): string | null {
  if (g.gt < p.abilityCooldownGt) return `Habilidad en enfriamiento (${Math.ceil((p.abilityCooldownGt - g.gt) / 1000)} s).`;
  return null;
}

function free(p: GPlayer): boolean {
  return p.state === 'free' && !p.timed && !p.panel && !p.vent && !p.locker;
}

/** Resuelve un identificador opaco del observador a la entidad real. */
function resolveHandle(g: Game, viewer: GPlayer, h: string): { kind: 'player'; p: GPlayer } | { kind: 'decoy'; id: string } | null {
  const key = viewer.handleRev.get(h);
  if (!key) return null;
  if (key.startsWith('p:')) { const p = g.players.get(key.slice(2)); return p ? { kind: 'player', p } : null; }
  if (key.startsWith('dis:')) { const p = g.players.get(key.split(':')[1]); return p ? { kind: 'player', p } : null; }
  if (key.startsWith('d:')) return { kind: 'decoy', id: key.slice(2) };
  return null;
}

export function handleAbility(g: Game, p: GPlayer, a: Extract<ClientAction, { k: 'ability' }>): string | null {
  if (!g.isExploring()) return 'Ahora no se puede.';
  if (!p.role || !p.alive) return 'No tienes habilidad.';
  const P = (k: string) => abilityRoleParam(g, p, k) ?? 0;
  switch (p.role) {
    case 'ingeniero':
      return 'Acércate a una trampilla y pulsa TRAMPILLA.';
    case 'saboteador':
      return 'Ventaja pasiva: tus preparaciones de sabotaje ya son más rápidas.';
    case 'analista': {
      if (p.analystOpenSince !== null) {
        p.analystOpenSince = null;
        p.abilityCooldownGt = g.gt + P('cooldown') * 1000;
        p.dirtyPriv = true;
        return null;
      }
      const r = ready(g, p); if (r) return r;
      if (p.battery <= 50) return 'Batería agotada: completa tareas para recargarla.';
      p.analystOpenSince = g.gt;
      g.event(p.id, { e: 'analyst', data: analystData(g) });
      p.dirtyPriv = true;
      return null;
    }
    case 'rastreador': {
      const r = ready(g, p); if (r) return r;
      if (!free(p)) return 'No puedes marcar ahora.';
      const tgt = a.target ? resolveHandle(g, p, a.target) : null;
      if (!tgt) return 'Elige a alguien visible y cercano.';
      let tx: number, ty: number, tl: string, id: string;
      if (tgt.kind === 'player') {
        if (!tgt.p.alive || hiddenFromOthers(tgt.p)) return 'No puedes marcar a esa persona.';
        tx = tgt.p.x; ty = tgt.p.y; tl = tgt.p.level; id = `p:${tgt.p.id}`;
      } else {
        const d = g.decoys.find((x) => x.id === tgt.id);
        if (!d) return 'No puedes marcar eso.';
        tx = d.x; ty = d.y; tl = d.level; id = `d:${d.id}`;
      }
      if (tl !== p.level || dist(p.x, p.y, tx, ty) > P('range') || !g.rt.los(p.level, p.x, p.y, tx, ty, g.doorState)) return 'Demasiado lejos para marcar.';
      p.tracker = { target: id, startGt: g.gt, endsGt: g.gt + (P('delay') + P('duration')) * 1000, nextGt: g.gt + P('delay') * 1000, readings: [] };
      p.abilityCooldownGt = g.gt + P('cooldown') * 1000;
      p.activeEndsGt = p.tracker.endsGt;
      p.dirtyPriv = true;
      return null;
    }
    case 'observador': {
      const r = ready(g, p); if (r) return r;
      if (p.abilityUses <= 0) return 'No te quedan activaciones.';
      if (!free(p) || p.carrying) return 'Necesitas estar libre y quieto.';
      const cam = g.map.cameras.find((c) => c.id === a.cam);
      if (!cam) return 'Elige una cámara.';
      if (camJammed(g, cam.id)) return 'SIN SEÑAL: comunicaciones caídas.';
      p.observing = { cam: cam.id, endsGt: g.gt + P('duration') * 1000 };
      p.state = 'observing';
      p.abilityUses--;
      p.activeEndsGt = p.observing.endsGt;
      p.abilityCooldownGt = p.observing.endsGt + P('cooldown') * 1000;
      g.openPanel(p, { kind: 'observer', cam: cam.id, endsGt: p.observing.endsGt });
      g.dirtyPub = true;
      p.dirtyPriv = true;
      return null;
    }
    case 'tecnico': {
      const r = ready(g, p); if (r) return r;
      p.techBoostEndsGt = g.gt + P('duration') * 1000;
      p.activeEndsGt = p.techBoostEndsGt;
      p.abilityCooldownGt = p.techBoostEndsGt + P('cooldown') * 1000;
      p.dirtyPriv = true;
      return null;
    }
    case 'explorador': {
      const r = ready(g, p); if (r) return r;
      if (p.carrying) return 'No puedes correr cargando la bandeja.';
      if (!free(p)) return 'No puedes correr ahora.';
      p.speedBoostEndsGt = g.gt + P('duration') * 1000;
      p.activeEndsGt = p.speedBoostEndsGt;
      p.abilityCooldownGt = p.speedBoostEndsGt + P('cooldown') * 1000;
      p.dirtyPriv = true;
      return null;
    }
    case 'vigilante': {
      const own = g.sensors.find((s) => s.owner === p.id);
      if (own && own.level === p.level && dist(p.x, p.y, own.x, own.y) <= P('range')) {
        if (g.commsDown()) return 'Sensor SIN SEÑAL.';
        const n = own.passes.length;
        const last = n ? Math.round((g.gt - own.passes[n - 1]) / 1000) : null;
        g.toast(p.id, n ? `Sensor: ${n} paso${n > 1 ? 's' : ''} registrado${n > 1 ? 's' : ''} (último hace ${last} s).` : 'Sensor: ningún paso registrado.', 'info');
        return null;
      }
      const r = ready(g, p); if (r) return r;
      if (p.abilityUses <= 0) return 'No te quedan sensores.';
      if (!free(p)) return 'No puedes instalarlo ahora.';
      let best: { id: string; d: number; x: number; y: number } | null = null;
      for (const d of g.map.doors) {
        if (!d.sensor || d.level !== p.level) continue;
        const cx = d.rect.x + d.rect.w / 2, cy = d.rect.y + d.rect.h / 2;
        const dd = dist(p.x, p.y, cx, cy);
        if (dd <= P('range') && (!best || dd < best.d)) best = { id: d.id, d: dd, x: cx, y: cy };
      }
      if (!best) return 'Debes estar junto a una puerta.';
      g.sensors = g.sensors.filter((s) => s.owner !== p.id);
      g.sensors.push({ id: randomId(6), owner: p.id, door: best.id, x: best.x, y: best.y, level: p.level, endsGt: g.gt + P('duration') * 1000, passes: [], maxPasses: P('maxPasses') });
      p.abilityUses--;
      p.abilityCooldownGt = g.gt + P('cooldown') * 1000;
      p.activeEndsGt = g.gt + P('duration') * 1000;
      fxAround(g, 'sensor', best.x, best.y, p.level);
      g.dirtyPub = true;
      p.dirtyPriv = true;
      return null;
    }
    case 'camuflador': {
      const r = ready(g, p); if (r) return r;
      if (!free(p) || p.invisible || p.disguise) return 'No puedes transformarte ahora.';
      const t = a.target ? g.players.get(a.target) : undefined;
      if (!t || t === p || !t.alive || t.left) return 'Elige a una persona viva.';
      p.disguise = { as: t.id, seq: ++g.disguiseSeq };
      p.activeEndsGt = g.gt + P('duration') * 1000;
      p.abilityCooldownGt = p.activeEndsGt + P('cooldown') * 1000;
      p.timed = { kind: 'cast', startGt: g.gt, endGt: g.gt + 450, data: {} };
      fxAround(g, 'poof', p.x, p.y, p.level);
      p.dirtyPriv = true;
      return null;
    }
    case 'espectro': {
      const r = ready(g, p); if (r) return r;
      if (!free(p) || p.carrying) return 'No puedes desvanecerte ahora.';
      fxAround(g, 'fade', p.x, p.y, p.level);
      p.invisible = true;
      p.activeEndsGt = g.gt + P('duration') * 1000;
      p.abilityCooldownGt = p.activeEndsGt + P('cooldown') * 1000;
      p.dirtyPriv = true;
      return null;
    }
    case 'interferente': {
      const r = ready(g, p); if (r) return r;
      if (p.abilityUses <= 0) return 'No te quedan usos.';
      if (g.sabotage) return 'No funciona con otro sabotaje activo.';
      if (!free(p)) return 'No puedes manipularlo ahora.';
      const zone = g.map.interference.find((z) => {
        const s = g.rt.stations.get(z.station);
        return s && s.level === p.level && dist(p.x, p.y, s.x, s.y) <= USE_RANGE + 10;
      });
      if (!zone) return 'Necesitas un terminal de comunicaciones cercano.';
      g.interference.push({ station: zone.station, cams: zone.cameras, zones: zone.zones, stations: zone.stations, endsGt: g.gt + P('duration') * 1000 });
      p.abilityUses--;
      p.activeEndsGt = g.gt + P('duration') * 1000;
      p.abilityCooldownGt = g.gt + P('cooldown') * 1000;
      p.timed = { kind: 'cast', startGt: g.gt, endGt: g.gt + 600, data: {} };
      g.dirtyPub = true;
      p.dirtyPriv = true;
      refreshCamPanels(g);
      return null;
    }
    case 'escapista': {
      const r = ready(g, p); if (r) return r;
      if (!free(p)) return 'Actívalo junto a una trampilla, antes de entrar.';
      const v = g.map.vents.find((x) => x.level === p.level && dist(p.x, p.y, x.x, x.y) <= 70);
      if (!v) return 'Necesitas estar junto a una trampilla.';
      const links = g.map.escapistLinks.filter(([a1, b1]) => a1 === v.id || b1 === v.id);
      if (!links.length) return 'Esta trampilla no tiene una ruta adicional.';
      for (const [a1, b1] of links) g.escapistLinks.push({ a: a1, b: b1, endsGt: g.gt + P('duration') * 1000 });
      p.activeEndsGt = g.gt + P('duration') * 1000;
      p.abilityCooldownGt = g.gt + P('cooldown') * 1000;
      p.dirtyPriv = true;
      return null;
    }
    case 'senuelo': {
      const r = ready(g, p); if (r) return r;
      if (p.abilityUses <= 0) return 'No te quedan señuelos.';
      if (!free(p) || p.disguise) return 'No puedes proyectarlo ahora.';
      const st = g.map.stations.find((s) => s.kind === 'task' && s.level === p.level && dist(p.x, p.y, s.x, s.y) <= USE_RANGE + 10);
      if (!st) return 'Colócalo junto a una estación de trabajo.';
      g.decoys = g.decoys.filter((d) => d.owner !== p.id);
      g.decoys.push({ id: randomId(6), owner: p.id, x: p.x, y: p.y, level: p.level, facing: st.x >= p.x ? 1 : -1, endsGt: g.gt + P('duration') * 1000, name: p.name, color: p.color, acc: p.acc });
      p.abilityUses--;
      p.activeEndsGt = g.gt + P('duration') * 1000;
      p.abilityCooldownGt = g.gt + P('cooldown') * 1000;
      fxAround(g, 'decoy', p.x, p.y, p.level);
      p.dirtyPriv = true;
      return null;
    }
  }
  return 'Habilidad desconocida.';
}

function refreshCamPanels(g: Game) {
  for (const o of g.players.values()) {
    if (o.sysPanel?.kind === 'cameras') {
      const noSignal = g.map.cameras.filter((c) => camJammed(g, c.id)).map((c) => c.id);
      g.openPanel(o, { kind: 'cameras', station: o.sysPanel.station, cams: g.map.cameras.map((c) => c.id), current: o.sysPanel.cam!, noSignal });
    }
  }
}

export function analystData(g: Game): AnalystData {
  if (g.commsDown()) return { systems: [], responsible: 'operativo', progress: 0, noSignal: true };
  const sab = g.sabotage;
  const def = g.sabotageDef();
  const systems: AnalystData['systems'] = [];
  for (const sb of g.map.sabotages) {
    const active = sab?.id === sb.id;
    systems.push({
      name: sb.name,
      state: active ? (sb.kind === 'critical' ? 'critico' : 'fallo') : 'ok',
      detail: active ? (sb.kind === 'critical' ? `Paso ${(sab!.step + 1)} de ${def!.repair.length}` : sb.kind === 'doors' ? 'Puertas cerradas' : 'Requiere reparación') : 'Nominal',
    });
  }
  const t = g.taskTotals();
  return { systems, responsible: g.responsible.struggling ? 'alterado' : 'operativo', progress: t.total ? t.done / t.total : 0, noSignal: false };
}

export function analystOnTaskDone(g: Game, p: GPlayer) {
  if (p.role !== 'analista') return;
  const max = (abilityRoleParam(g, p, 'battery') ?? 8) * 1000;
  p.battery = Math.min(max, p.battery + (abilityRoleParam(g, p, 'recharge') ?? 4) * 1000);
  p.dirtyPriv = true;
}

export function abilityTick(g: Game) {
  const gt = g.gt;
  for (const p of g.players.values()) {
    if (p.analystOpenSince !== null) {
      p.battery -= 1000 / 30;
      if (g.tickNo % 10 === 0) g.event(p.id, { e: 'analyst', data: analystData(g) });
      if (g.tickNo % 15 === 0) p.dirtyPriv = true;
      if (p.battery <= 0 || !p.alive) {
        p.battery = Math.max(0, p.battery);
        p.analystOpenSince = null;
        p.abilityCooldownGt = gt + (abilityRoleParam(g, p, 'cooldown') ?? 10) * 1000;
        p.dirtyPriv = true;
      }
    }
    if (p.tracker) {
      const tr = p.tracker;
      if (gt >= tr.nextGt && gt <= tr.endsGt) {
        tr.nextGt = gt + (abilityRoleParam(g, p, 'interval') ?? 2) * 1000;
        if (!g.commsDown()) {
          let reading: { x: number; y: number; l: string; gt: number; none?: boolean };
          if (tr.target.startsWith('p:')) {
            const t = g.players.get(tr.target.slice(2));
            if (!t || !t.alive || t.left || t.state === 'vent' || t.timed?.kind === 'ladder') reading = { x: 0, y: 0, l: '', gt, none: true };
            else reading = { x: Math.round(t.x), y: Math.round(t.y), l: t.level, gt };
          } else {
            const d = g.decoys.find((x) => `d:${x.id}` === tr.target);
            reading = d ? { x: Math.round(d.x), y: Math.round(d.y), l: d.level, gt } : { x: 0, y: 0, l: '', gt, none: true };
          }
          tr.readings.push(reading);
          if (tr.readings.length > 8) tr.readings.shift();
        }
        p.dirtyPriv = true;
      }
      if (gt > tr.endsGt + 4000) { p.tracker = null; p.dirtyPriv = true; }
    }
    if (p.observing && gt >= p.observing.endsGt) {
      p.observing = null;
      if (p.state === 'observing') p.state = 'free';
      g.host.send(p.id, 'panel', null);
      g.dirtyPub = true;
      p.dirtyPriv = true;
    }
    if (p.observing && camJammed(g, p.observing.cam)) {
      // La cámara queda sin señal; la consulta sigue consumiendo tiempo.
    }
    if (p.disguise && gt >= p.activeEndsGt) {
      p.disguise = null;
      fxAround(g, 'poof', p.x, p.y, p.level);
      p.dirtyPriv = true;
    }
    if (p.invisible && gt >= p.activeEndsGt) {
      p.invisible = false;
      fxAround(g, 'unfade', p.x, p.y, p.level);
      p.dirtyPriv = true;
    }
    if (p.speedBoostEndsGt && gt >= p.speedBoostEndsGt && p.speedBoostEndsGt > gt - 40) p.dirtyPriv = true;
    if (p.techBoostEndsGt && gt >= p.techBoostEndsGt && p.techBoostEndsGt > gt - 40) p.dirtyPriv = true;
  }
  const nd = g.decoys.length;
  g.decoys = g.decoys.filter((d) => d.endsGt > gt);
  if (nd !== g.decoys.length) g.dirtyPub = true;
  const ni = g.interference.length;
  g.interference = g.interference.filter((i) => i.endsGt > gt);
  if (ni !== g.interference.length) { g.dirtyPub = true; refreshCamPanels(g); }
  g.escapistLinks = g.escapistLinks.filter((e) => e.endsGt > gt);
  for (const p of g.players.values()) {
    if (p.state === 'vent' && p.sysPanel?.kind === 'vent' && g.tickNo % 15 === 0) {
      g.openPanel(p, { kind: 'vent', vent: p.vent!.id, links: g.ventLinksFor(p.vent!.id) });
    }
  }
}

/** Las reuniones cancelan disfraces, invisibilidad, cámaras remotas, señuelos y sensores (sin reembolso). */
export function cancelAbilitiesForMeeting(g: Game) {
  for (const p of g.players.values()) {
    if (p.disguise) { p.disguise = null; p.activeEndsGt = g.gt; }
    if (p.invisible) { p.invisible = false; p.activeEndsGt = g.gt; }
    p.observing = null;
    if (p.analystOpenSince !== null) { p.analystOpenSince = null; }
    p.dirtyPriv = true;
  }
  g.decoys = [];
  g.sensors = [];
  g.interference = [];
  g.escapistLinks = [];
  g.dirtyPub = true;
}
