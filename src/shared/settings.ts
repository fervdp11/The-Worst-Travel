import { MAX_PLAYERS, MIN_PLAYERS } from './constants';
import type { MapId } from './maps/types';
import { Rng } from './rng';
import { IMPOSTOR_ROLES, ROLES, ROLE_BY_ID, RoleId, Team, WORKER_ROLES } from './roles';

export type TaskBarMode = 'always' | 'meetings' | 'never';

export interface GameSettings {
  maxPlayers: number;
  playerSpeed: number;
  visionWorker: number;
  visionImpostor: number;
  shortTasks: number;
  longTasks: number;
  sabotageCooldown: number;
  criticalTime: number;
  sabotageGrace: number;
  sabotagePrep: number;
  doorDuration: number;
  knifeComplexity: number;
  attackDuration: number;
  discussionTime: number;
  votingTime: number;
  meetingsPerPlayer: number;
  buttonCooldown: number;
  anonymousVotes: boolean;
  revealTeam: boolean;
  taskBarMode: TaskBarMode;
  visualTasks: boolean;
  ventStay: number;
  ventCooldown: number;
  lockerTime: number;
  arrivalTime: number;
}

export interface RoleSettings {
  enabled: boolean;
  chance: number;
  max: number;
  params: Record<string, number>;
}

export type PresetId = 'clasico' | 'equilibrado' | 'personalizado';

export interface RoomSettings {
  preset: PresetId;
  game: GameSettings;
  roles: Record<RoleId, RoleSettings>;
}

export interface NumField {
  key: keyof GameSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  help: string;
  tab: 'partida' | 'mapa';
}

/** Descripción de los ajustes de partida para la interfaz (rangos validados en servidor). */
export const GAME_FIELDS: NumField[] = [
  { key: 'maxPlayers', label: 'Plazas máximas', min: MIN_PLAYERS, max: MAX_PLAYERS, step: 1, unit: '', help: 'Siempre hay exactamente un impostor.', tab: 'partida' },
  { key: 'playerSpeed', label: 'Velocidad', min: 0.75, max: 1.5, step: 0.05, unit: '×', help: 'Multiplicador de velocidad de todos los empleados.', tab: 'partida' },
  { key: 'visionWorker', label: 'Visión de trabajadores', min: 0.5, max: 2, step: 0.05, unit: '×', help: 'Radio de visión base de los trabajadores.', tab: 'partida' },
  { key: 'visionImpostor', label: 'Visión del impostor', min: 0.5, max: 2.5, step: 0.05, unit: '×', help: 'El impostor conserva esta visión durante los apagones.', tab: 'partida' },
  { key: 'shortTasks', label: 'Tareas cortas', min: 1, max: 6, step: 1, unit: '', help: 'Tareas cortas obligatorias por trabajador.', tab: 'partida' },
  { key: 'longTasks', label: 'Tareas largas', min: 0, max: 3, step: 1, unit: '', help: 'Tareas largas o de varias etapas por trabajador.', tab: 'partida' },
  { key: 'discussionTime', label: 'Tiempo de discusión', min: 0, max: 120, step: 5, unit: 's', help: 'Durante la discusión no se vota.', tab: 'partida' },
  { key: 'votingTime', label: 'Tiempo de votación', min: 15, max: 120, step: 5, unit: 's', help: 'Se puede seguir chateando mientras se vota.', tab: 'partida' },
  { key: 'meetingsPerPlayer', label: 'Reuniones por persona', min: 0, max: 5, step: 1, unit: '', help: 'Pulsaciones del botón de emergencia por jugador.', tab: 'partida' },
  { key: 'buttonCooldown', label: 'Enfriamiento del botón', min: 0, max: 60, step: 5, unit: 's', help: 'Tiempo tras cada reunión antes de poder convocar otra.', tab: 'partida' },
  { key: 'sabotageCooldown', label: 'Enfriamiento de sabotajes', min: 20, max: 120, step: 5, unit: 's', help: 'Se reinicia cuando termina el sabotaje anterior.', tab: 'mapa' },
  { key: 'criticalTime', label: 'Plazo de críticos', min: 40, max: 120, step: 5, unit: 's', help: 'Se ajusta según las distancias de cada vehículo.', tab: 'mapa' },
  { key: 'sabotageGrace', label: 'Protección inicial', min: 15, max: 120, step: 5, unit: 's', help: 'Tiempo inicial sin sabotajes.', tab: 'mapa' },
  { key: 'sabotagePrep', label: 'Preparación de sabotaje', min: 1, max: 8, step: 0.5, unit: 's', help: 'Tiempo de manipulación física en la instalación.', tab: 'mapa' },
  { key: 'doorDuration', label: 'Cierre de puertas', min: 5, max: 15, step: 1, unit: 's', help: 'Duración máxima del cierre; hay apertura de seguridad.', tab: 'mapa' },
  { key: 'knifeComplexity', label: 'Complejidad del cuchillo', min: 1, max: 3, step: 1, unit: '', help: '1: pistas exactas · 2: pistas por sala · 3: más lugares de búsqueda.', tab: 'mapa' },
  { key: 'attackDuration', label: 'Duración del ataque', min: 1.5, max: 5, step: 0.5, unit: 's', help: 'Interacción necesaria junto al responsable.', tab: 'mapa' },
  { key: 'ventStay', label: 'Estancia en trampillas', min: 4, max: 30, step: 1, unit: 's', help: 'Estancia máxima del impostor (el Ingeniero tiene su propio valor).', tab: 'mapa' },
  { key: 'ventCooldown', label: 'Enfriamiento de trampillas', min: 0, max: 60, step: 5, unit: 's', help: 'Enfriamiento del impostor tras salir.', tab: 'mapa' },
  { key: 'lockerTime', label: 'Tiempo en taquilla', min: 6, max: 20, step: 1, unit: 's', help: 'Máximo antes de salir automáticamente.', tab: 'mapa' },
  { key: 'arrivalTime', label: 'Maniobra de llegada', min: 10, max: 40, step: 5, unit: 's', help: 'Tiempo de llegada tras completar el trabajo, sin críticos activos.', tab: 'mapa' },
];

export const DEFAULT_GAME: GameSettings = {
  maxPlayers: 8, playerSpeed: 1, visionWorker: 1, visionImpostor: 1.25, shortTasks: 3, longTasks: 2,
  sabotageCooldown: 45, criticalTime: 70, sabotageGrace: 45, sabotagePrep: 3, doorDuration: 10,
  knifeComplexity: 2, attackDuration: 2.5, discussionTime: 40, votingTime: 35, meetingsPerPlayer: 1,
  buttonCooldown: 30, anonymousVotes: true, revealTeam: true, taskBarMode: 'meetings', visualTasks: false,
  ventStay: 10, ventCooldown: 15, lockerTime: 12, arrivalTime: 20,
};

function roleDefaults(chance: number, enabled: boolean, id: RoleId): RoleSettings {
  const params: Record<string, number> = {};
  for (const p of ROLE_BY_ID[id].params) params[p.key] = p.def;
  return { enabled, chance: enabled ? chance : 0, max: 1, params };
}

export function presetSettings(preset: PresetId, base?: RoomSettings): RoomSettings {
  const game = { ...(base?.game ?? DEFAULT_GAME) };
  const roles = {} as Record<RoleId, RoleSettings>;
  for (const r of ROLES) {
    if (preset === 'clasico') roles[r.id] = roleDefaults(0, false, r.id);
    else if (preset === 'equilibrado') roles[r.id] = roleDefaults(r.team === 'worker' ? 25 : 15, true, r.id);
    else roles[r.id] = base ? structuredClone(base.roles[r.id]) : roleDefaults(25, true, r.id);
  }
  return { preset, game, roles };
}

export function defaultSettings(): RoomSettings {
  return presetSettings('equilibrado');
}

export interface SettingsIssue {
  field: string;
  msg: string;
}

const snap = (v: number, min: number, max: number, step: number) => {
  const c = Math.min(max, Math.max(min, v));
  const s = Math.round((c - min) / step) * step + min;
  return Math.round(Math.min(max, s) * 1000) / 1000;
};

/** Normaliza y acota cualquier ajuste recibido (el servidor nunca confía en el cliente). */
export function sanitizeSettings(input: unknown, prev: RoomSettings): RoomSettings {
  const out = structuredClone(prev);
  const src = (input ?? {}) as Partial<RoomSettings>;
  if (src.preset === 'clasico' || src.preset === 'equilibrado' || src.preset === 'personalizado') out.preset = src.preset;
  if (src.game && typeof src.game === 'object') {
    for (const f of GAME_FIELDS) {
      const v = (src.game as unknown as Record<string, unknown>)[f.key];
      if (typeof v === 'number' && Number.isFinite(v)) (out.game as unknown as Record<string, number>)[f.key] = snap(v, f.min, f.max, f.step);
    }
    for (const k of ['anonymousVotes', 'revealTeam', 'visualTasks'] as const) {
      const v = (src.game as unknown as Record<string, unknown>)[k];
      if (typeof v === 'boolean') out.game[k] = v;
    }
    const tb = (src.game as unknown as Record<string, unknown>).taskBarMode;
    if (tb === 'always' || tb === 'meetings' || tb === 'never') out.game.taskBarMode = tb;
  }
  if (src.roles && typeof src.roles === 'object') {
    for (const r of ROLES) {
      const rs = (src.roles as Record<string, Partial<RoleSettings>>)[r.id];
      if (!rs) continue;
      const cur = out.roles[r.id];
      if (typeof rs.enabled === 'boolean') cur.enabled = rs.enabled;
      if (typeof rs.chance === 'number' && Number.isFinite(rs.chance)) cur.chance = snap(rs.chance, 0, 100, 5);
      const maxCap = r.team === 'impostor' ? 1 : MAX_PLAYERS - 1;
      if (typeof rs.max === 'number' && Number.isFinite(rs.max)) cur.max = snap(rs.max, 0, maxCap, 1);
      if (rs.params && typeof rs.params === 'object') {
        for (const p of r.params) {
          const v = (rs.params as Record<string, unknown>)[p.key];
          if (typeof v === 'number' && Number.isFinite(v)) cur.params[p.key] = snap(v, p.min, p.max, p.step);
        }
      }
      if (!cur.enabled) cur.chance = 0;
    }
  }
  return out;
}

export function effectiveChance(rs: RoleSettings): number {
  return rs.enabled ? rs.chance : 0;
}

/** Comprueba la configuración para el número de humanos conectados. */
export function validateSettings(s: RoomSettings, humans: number): SettingsIssue[] {
  const issues: SettingsIssue[] = [];
  const workers = Math.max(0, humans - 1);
  const workerSlots = Math.max(0, s.game.maxPlayers - 1);
  let guaranteedW = 0;
  for (const id of WORKER_ROLES) {
    const rs = s.roles[id];
    if (effectiveChance(rs) === 100) guaranteedW += rs.max;
    if (rs.max > workerSlots) issues.push({ field: `role.${id}.max`, msg: `${ROLE_BY_ID[id].name}: el máximo (${rs.max}) supera las ${workerSlots} plazas de trabajador.` });
  }
  if (guaranteedW > workerSlots) {
    issues.push({ field: 'roles.worker', msg: `Hay ${guaranteedW} especialidades de trabajador garantizadas al 100 % y solo ${workerSlots} plazas. Reduce el máximo o la posibilidad de alguna.` });
  } else if (humans >= MIN_PLAYERS && guaranteedW > workers) {
    issues.push({ field: 'roles.worker', msg: `Con ${humans} personas hay ${workers} trabajadores, pero ${guaranteedW} especialidades garantizadas. Reduce alguna garantía.` });
  }
  const guaranteedI = IMPOSTOR_ROLES.filter((id) => effectiveChance(s.roles[id]) === 100 && s.roles[id].max > 0).length;
  if (guaranteedI > 1) issues.push({ field: 'roles.impostor', msg: `Solo hay un impostor: únicamente una especialidad de impostor puede estar al 100 % (ahora hay ${guaranteedI}).` });
  if (s.game.shortTasks + s.game.longTasks < 1) issues.push({ field: 'game.shortTasks', msg: 'Cada trabajador necesita al menos una tarea.' });
  if (humans > s.game.maxPlayers) issues.push({ field: 'game.maxPlayers', msg: `Hay ${humans} personas en la sala y el máximo es ${s.game.maxPlayers}.` });
  return issues;
}

export interface Assignment {
  impostor: string;
  roles: Record<string, RoleId | null>;
  team: Record<string, Team>;
}

/**
 * Asignación sin ambigüedades: cada plaza configurada tira con su porcentaje.
 * 0 % no participa, 100 % es plaza garantizada. Primero se reservan las garantizadas
 * y luego se mezclan las candidaturas que superaron su tirada. Máximo una especialidad
 * por persona; quien no recibe ninguna queda sin rol.
 */
export function assignRoles(rng: Rng, players: string[], s: RoomSettings): Assignment {
  if (players.length < 1) throw new Error('Sin jugadores');
  const ids = [...players];
  const impostor = ids[Math.floor(rng.next() * ids.length)];
  const workers = rng.shuffle(ids.filter((p) => p !== impostor));
  const roles: Record<string, RoleId | null> = {};
  const team: Record<string, Team> = {};
  for (const p of ids) { roles[p] = null; team[p] = p === impostor ? 'impostor' : 'worker'; }

  const fill = (members: string[], pool: RoleId[]) => {
    const guaranteed: RoleId[] = [];
    const candidates: RoleId[] = [];
    for (const id of pool) {
      const rs = s.roles[id];
      const ch = effectiveChance(rs);
      if (ch <= 0) continue;
      for (let k = 0; k < rs.max; k++) {
        if (ch >= 100) guaranteed.push(id);
        else if (rng.next() * 100 < ch) candidates.push(id);
      }
    }
    if (guaranteed.length > members.length) throw new Error('Garantías incompatibles');
    const free = rng.shuffle([...members]);
    rng.shuffle(guaranteed);
    for (const id of guaranteed) roles[free.shift()!] = id;
    rng.shuffle(candidates);
    for (const id of candidates) {
      if (!free.length) break;
      roles[free.shift()!] = id;
    }
  };
  fill(workers, WORKER_ROLES);
  fill([impostor], IMPOSTOR_ROLES);
  return { impostor, roles, team };
}

export function effectiveCriticalTime(s: GameSettings, critScale: number): number {
  return Math.round(s.criticalTime * critScale);
}

export interface FrozenConfig {
  version: number;
  mapId: MapId;
  seed: number;
  settings: RoomSettings;
}
