import type { AnimCode, PlayerStateCode } from '../../shared/protocol';
import type { RoleId, Team } from '../../shared/roles';
import type { TaskSlotDef } from '../../shared/maps/types';

export interface TaskInst {
  id: string;
  slot: TaskSlotDef;
  stations: string[];
  stage: number;
  /** Partes confirmadas dentro de la etapa actual (persisten tras reuniones). */
  part: number;
  done: boolean;
  fake: boolean;
  memory: Record<string, unknown>;
  puzzles: (Record<string, unknown> | null)[];
}

export type TimedKind =
  | 'ladder' | 'ventIn' | 'ventMove' | 'ventOut' | 'lockerIn' | 'lockerOut' | 'sabotage'
  | 'attack' | 'doorOpen' | 'cast';

export interface TimedAction {
  kind: TimedKind;
  startGt: number;
  endGt: number;
  data: Record<string, any>;
}

export interface PanelCtx {
  ctx: 'task' | 'repair' | 'knife' | 'fake';
  ref: string;
  station: string;
  mg: string;
  part: number;
  partStartGt: number;
  puzzle: Record<string, unknown>;
  /** Para reparaciones: paso del sabotaje al abrir. */
  sabStep?: number;
  /** Factor de espera aplicado (Técnico). */
  waitFactor: number;
  decoy?: boolean;
}

export interface GPlayer {
  id: string;
  name: string;
  color: number;
  acc: number;
  team: Team;
  role: RoleId | null;
  alive: boolean;
  left: boolean;
  connected: boolean;
  disconnectedAt: number;
  x: number;
  y: number;
  level: string;
  facing: 1 | -1;
  moving: boolean;
  inputs: { s: number; dx: number; dy: number }[];
  credit: number;
  ack: number;
  lastQueued: number;
  state: PlayerStateCode;
  timed: TimedAction | null;
  panel: PanelCtx | null;
  /** Panel de sistema abierto (cámaras, ocupación, sabotaje, trampilla). */
  sysPanel: { kind: 'cameras' | 'occupancy' | 'sabotage' | 'vent'; station: string; cam?: string; level?: string } | null;
  tasks: TaskInst[];
  meetingsLeft: number;
  carrying: boolean;
  vent: { id: string; untilGt: number } | null;
  ventCooldownGt: number;
  locker: { id: string; untilGt: number } | null;
  saved: { x: number; y: number; level: string } | null;
  handles: Map<string, string>;
  handleRev: Map<string, string>;
  recentActs: string[];
  // Habilidades
  abilityCooldownGt: number;
  abilityUses: number;
  activeEndsGt: number;
  battery: number;
  analystOpenSince: number | null;
  disguise: { as: string; seq: number } | null;
  invisible: boolean;
  speedBoostEndsGt: number;
  techBoostEndsGt: number;
  tracker: { target: string; startGt: number; endsGt: number; nextGt: number; readings: { x: number; y: number; l: string; gt: number; none?: boolean }[] } | null;
  observing: { cam: string; endsGt: number } | null;
  // Cuchillo
  knife: { stage: number; hasKnife: boolean; authorized: boolean; clue: string; codeParts: string[]; searched: string[] } | null;
  lastDoorRects: Set<string>;
  dirtyPriv: boolean;
  anim: AnimCode;
}

export interface Decoy {
  id: string;
  owner: string;
  x: number;
  y: number;
  level: string;
  facing: 1 | -1;
  endsGt: number;
  name: string;
  color: number;
  acc: number;
}

export interface Sensor {
  id: string;
  owner: string;
  door: string;
  x: number;
  y: number;
  level: string;
  endsGt: number;
  passes: number[];
  maxPasses: number;
}

export interface Interference {
  station: string;
  cams: string[];
  zones: string[];
  stations: string[];
  endsGt: number;
}

export interface ActiveSabotage {
  id: string;
  startedGt: number;
  endsGt: number | null;
  step: number;
  doorGroup?: string;
}
