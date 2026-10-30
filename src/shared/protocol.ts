import type { MapId } from './maps/types';
import type { RoleId, Team } from './roles';
import type { RoomSettings, SettingsIssue } from './settings';

/** Versión del protocolo: cliente y servidor deben coincidir. */
export const PROTOCOL_VERSION = 7;

export type Phase = 'ESPERA' | 'INICIO' | 'EXPLORACION' | 'DISCUSION' | 'VOTACION' | 'RESULTADOS' | 'EXPULSION' | 'FINAL';

export interface LobbyPlayer {
  id: string;
  name: string;
  color: number;
  acc: number;
  connected: boolean;
  host: boolean;
  /** Recursos del mapa seleccionado cargados en su cliente. */
  loaded: boolean;
}

export interface RoomState {
  code: string;
  practice: boolean;
  hostId: string;
  phase: Phase;
  mapId: MapId;
  players: LobbyPlayer[];
  settings: RoomSettings;
  configVersion: number;
  issues: SettingsIssue[];
  countdownEnds: number | null;
  canStart: boolean;
  startBlockers: string[];
  practiceTeam?: Team;
  practiceRole?: RoleId | null;
}

// ------------------- Exploración -------------------

export type AnimCode =
  | 'idle' | 'walk' | 'task' | 'repair' | 'climb' | 'ventIn' | 'ventOut' | 'lockerIn' | 'lockerOut'
  | 'attack' | 'cams' | 'search' | 'cast' | 'decoy' | 'stopped';

export interface EntSnap {
  /** Identificador opaco por observador (no revela la identidad real). */
  h: string;
  k: 'p' | 'r' | 'd' | 'g';
  x: number;
  y: number;
  l: string;
  f: 1 | -1;
  a: AnimCode;
  n: string;
  c: number;
  ac: number;
  /** Lleva bandeja. */
  tr?: 1;
  /** Desconectado (detenido). */
  dc?: 1;
  /** Visto solo a través de cámara. */
  cam?: string;
  /** Distorsión del señuelo al acercarse. */
  dz?: 1;
  /** Velocidad extra visible (Explorador). */
  sp?: 1;
}

export interface SelfSnap {
  x: number;
  y: number;
  l: string;
  ack: number;
  st: PlayerStateCode;
  f: 1 | -1;
  vis: number;
  speed: number;
}

export type PlayerStateCode =
  | 'free' | 'panel' | 'ladder' | 'vent' | 'locker' | 'cams' | 'sabotaging' | 'attacking' | 'ghost'
  | 'intro' | 'meeting' | 'observing' | 'stopped';

export interface Snapshot {
  t: number;
  gt: number;
  me: SelfSnap | null;
  e: EntSnap[];
}

export interface SabotageState {
  id: string;
  kind: 'lights' | 'comms' | 'doors' | 'critical';
  name: string;
  startedGt: number;
  endsGt: number | null;
  step: number;
  steps: { label: string; stations: string[]; level: string }[];
  doorGroup?: string;
}

export interface MeetingPublic {
  stage: 'call' | 'discuss' | 'vote' | 'results' | 'eject';
  caller: string;
  callerName: string;
  button: string;
  voted: string[];
  results?: {
    counts: Record<string, number>;
    votes?: Record<string, string>;
    ejected: string | null;
    ejectedName?: string;
    ejectedColor?: number;
    tie: boolean;
    skipped: boolean;
    reveal: Team | null;
  };
}

export interface PlayerPublic {
  id: string;
  name: string;
  color: number;
  acc: number;
  alive: boolean;
  connected: boolean;
  left: boolean;
}

export interface EndResult {
  winner: 'workers' | 'impostor' | 'cancelled';
  cause: 'ejected' | 'tasks' | 'critical' | 'murder' | 'abandon' | 'cancelled';
  title: string;
  text: string;
  scene: string;
  impostorId: string;
  roles: { id: string; name: string; color: number; team: Team; role: RoleId | null }[];
}

export interface PublicGame {
  phase: Phase;
  phaseEnds: number | null;
  mapId: MapId;
  gt: number;
  players: PlayerPublic[];
  taskProgress: number | null;
  sabotage: SabotageState | null;
  sabotageReadyGt: number;
  closedDoors: string[];
  doorsOpenGt: number | null;
  arrival: { endsGt: number; paused: boolean } | null;
  meeting: MeetingPublic | null;
  buttonReadyGt: number;
  camLeds: string[];
  result: EndResult | null;
  sensors: { id: string; x: number; y: number; l: string }[];
  attackInProgress: boolean;
}

export interface TaskPrivate {
  id: string;
  type: string;
  name: string;
  length: 'short' | 'long';
  stage: number;
  stages: number;
  done: boolean;
  station: string | null;
  stationName: string;
  level: string;
  label: string;
  fake: boolean;
}

export interface AbilityPrivate {
  role: RoleId;
  cooldownEndsGt: number;
  activeEndsGt: number;
  uses: number | null;
  battery?: number;
  maxBattery?: number;
  target?: string;
  passive: boolean;
}

export interface KnifePrivate {
  stage: number;
  objective: string;
  clue: string;
  codeParts: string[];
  hasKnife: boolean;
  authorized: boolean;
  /** Estaciones donde actuar ahora (solo nombres y posiciones, nunca el resultado). */
  hints: { id: string; name: string; level: string; x: number; y: number }[];
}

export interface PrivateState {
  team: Team;
  role: RoleId | null;
  roleName: string;
  tasks: TaskPrivate[];
  meetingsLeft: number;
  knife: KnifePrivate | null;
  ability: AbilityPrivate | null;
  ventCooldownGt: number;
  ventUntilGt: number;
  ventLinks: string[];
  lockerUntilGt: number;
  sabotageStations: { id: string; sabotage: string; name: string; level: string; x: number; y: number }[];
  tracker: { readings: { x: number; y: number; l: string; gt: number; none?: boolean }[]; endsGt: number } | null;
  sensor: { id: string; x: number; y: number; l: string; endsGt: number; passes: number[]; noSignal: boolean } | null;
  carrying: boolean;
  disguised: boolean;
  invisible: boolean;
  techBoostEndsGt: number;
  speedBoostEndsGt: number;
  responsible: { title: string; name: string };
  vision: number;
}

/** Paneles (minijuegos, cámaras, ocupación, diagnóstico) abiertos para este jugador. */
export type PanelOpen =
  | { kind: 'minigame'; ctx: 'task' | 'repair' | 'knife' | 'fake'; ref: string; station: string; mg: string; part: number; puzzle: Record<string, unknown>; title: string; theme: MapId }
  | { kind: 'cameras'; station: string; cams: string[]; current: string; noSignal: string[] }
  | { kind: 'occupancy'; station: string }
  | { kind: 'observer'; cam: string; endsGt: number }
  | { kind: 'sabotage'; station: string; options: { id: string; name: string; group?: string }[] }
  | { kind: 'wardrobe' }
  | { kind: 'kiosk' }
  | { kind: 'vent'; vent: string; links: { id: string; name: string; extra: boolean }[] };

export interface OccupancyData {
  level: string;
  zones: { id: string; name: string; count: number | null; noise: boolean }[];
  t: number;
  noSignal: boolean;
}

export interface AnalystData {
  systems: { name: string; state: 'ok' | 'fallo' | 'critico'; detail: string }[];
  responsible: 'operativo' | 'alterado';
  progress: number;
  noSignal: boolean;
}

export type ClientAction =
  | { k: 'use'; st: string }
  | { k: 'sabotage'; st: string; opt?: string }
  | { k: 'step'; ref: string; part: number; ans: Record<string, unknown> }
  | { k: 'close' }
  | { k: 'vent'; to?: string; exit?: boolean }
  | { k: 'ability'; target?: string; cam?: string }
  | { k: 'attack' }
  | { k: 'vote'; target: string }
  | { k: 'cam'; cam: string }
  | { k: 'occ'; level: string }
  | { k: 'analyst' }
  | { k: 'leaveLocker' };

export type ActionMsg = ClientAction & { id: string };

export interface ChatMsg {
  ch: 'lobby' | 'meeting' | 'ghost';
  from: string;
  name: string;
  color: number;
  text: string;
  t: number;
}

export type GameEvent =
  | { e: 'fx'; fx: 'vent' | 'poof' | 'fade' | 'unfade' | 'decoy' | 'sensor' | 'tray' | 'sparkle' | 'locker'; x: number; y: number; l: string }
  | { e: 'toast'; text: string; tone?: 'info' | 'warn' | 'ok' | 'bad' }
  | { e: 'sound'; s: string; x?: number; y?: number; l?: string }
  | { e: 'meeting'; caller: string; callerName: string }
  | { e: 'end'; result: EndResult }
  | { e: 'panelClose' }
  | { e: 'stepOk'; ref: string; part: number; done: boolean; reveal?: string }
  | { e: 'stepBad'; ref: string; part: number; msg: string }
  | { e: 'occ'; data: OccupancyData }
  | { e: 'analyst'; data: AnalystData }
  | { e: 'teleport'; x: number; y: number; l: string };

export interface GameStart {
  mapId: MapId;
  seed: number;
  configVersion: number;
  you: string;
  settings: RoomSettings;
}

export interface ServerToClient {
  welcome: (d: { pid: string; token: string; v: number; serverTime: number }) => void;
  room: (d: RoomState | null) => void;
  err: (d: { code: string; msg: string }) => void;
  ack: (d: { id: string; ok: boolean; msg?: string }) => void;
  gstart: (d: GameStart) => void;
  snap: (d: Snapshot) => void;
  pub: (d: PublicGame) => void;
  priv: (d: PrivateState) => void;
  panel: (d: PanelOpen | null) => void;
  ev: (d: GameEvent) => void;
  chat: (d: ChatMsg) => void;
  pong: (d: { t: number; st: number }) => void;
}

export interface ClientToServer {
  hello: (d: { v: number; token?: string; name?: string }) => void;
  create: (d: { name: string; mapId: MapId; maxPlayers: number; preset: string }) => void;
  join: (d: { code: string; name: string }) => void;
  practice: (d: { name: string; mapId: MapId; team: Team; role: RoleId | null }) => void;
  leave: () => void;
  settings: (d: { patch: unknown; mapId?: MapId }) => void;
  start: () => void;
  cancel: () => void;
  custom: (d: { color?: number; acc?: number; name?: string }) => void;
  chat: (d: { text: string }) => void;
  inp: (d: { s: number; d: number[] }) => void;
  act: (d: ActionMsg) => void;
  back: () => void;
  loaded: (d: { mapId: MapId }) => void;
  ping: (d: { t: number }) => void;
}
