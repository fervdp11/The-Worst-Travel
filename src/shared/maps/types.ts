import type { Rect, Vec } from '../geometry';

/** Mapas jugables. Viaje: barco y avión. Supermercado: edificio propio. */
export type MapId = 'ship' | 'plane' | 'market';
export type TravelMapId = 'ship' | 'plane';
export type AnyMapId = MapId | 'lobby';
export type GameMode = 'travel' | 'market';

export type FloorKind =
  | 'carpet' | 'wood' | 'metal' | 'tile' | 'lino' | 'deck' | 'grate'
  | 'checker' | 'rubber' | 'concrete' | 'parquet' | 'cabin' | 'terrazzo' | 'marketTile';
export type LightKind = 'warm' | 'cold' | 'neutral' | 'exterior' | 'dim';

export interface LevelDef {
  id: string;
  name: string;
  index: number;
  /** Área de simulación del nivel (incluye márgenes exteriores no transitables). */
  bounds: Rect;
  /** Contorno visual del vehículo en este nivel (casco, fuselaje, vagones). */
  outline: Vec[][];
}

export interface RoomDef {
  id: string;
  name: string;
  level: string;
  rect: Rect;
  floor: FloorKind;
  light: LightKind;
  accent: string;
  /** Zona del panel de ocupación. */
  zone: string;
  exterior?: boolean;
  /** Rectángulos adicionales de suelo que pertenecen a la sala. */
  extra?: Rect[];
}

export type WallKind = 'hull' | 'wall' | 'partition' | 'rail' | 'edge' | 'bellows' | 'glass';

export interface WallDef {
  level: string;
  rect: Rect;
  kind: WallKind;
  /** Bloquea la visión. Las barandillas y bordes no. */
  occludes: boolean;
  /** Dibuja cara frontal (muros horizontales). */
  face: boolean;
  /** No se pinta (colisión de casco curvo, bordes del techo...). */
  invisible?: boolean;
  /** Ventanas pintadas en la cara del muro (posiciones x). */
  windows?: number[];
  /** Muro lineal diagonal (casco curvo, barandilla): segmento y semigrosor. `rect` es su caja. */
  seg?: { ax: number; ay: number; bx: number; by: number; half: number };
}

export interface DoorDef {
  id: string;
  name: string;
  level: string;
  rect: Rect;
  orient: 'h' | 'v';
  /** Puede cerrarse con el sabotaje de puertas. */
  lockable: boolean;
  /** Umbral para el sensor del Vigilante (siempre el rect de la puerta). */
  sensor: boolean;
}

export interface PropDef {
  id: string;
  level: string;
  kind: string;
  /** Huella en el suelo (colisión si es sólido). */
  rect: Rect;
  /** Altura aparente en píxeles de mundo. */
  h: number;
  solid: boolean;
  variant?: number;
  flip?: boolean;
  color?: string;
  label?: string;
  /** Se dibuja dentro del fondo estático (sin ordenación por pies). */
  flat?: boolean;
  /** Montado en pared/barandilla (sin colisión ni sombra de suelo). */
  mount?: 'floor' | 'wall';
  /** Fuerza que bloquee (o no) la visión. Por defecto: objetos altos marcados. */
  occlude?: boolean;
  /** Tipo de sombra (por defecto según el tipo de objeto). */
  shadow?: 'box' | 'legs' | 'pole' | 'wall' | 'low' | 'none';
  anim?: 'blink' | 'fan' | 'steam' | 'screen' | 'curtain' | 'liquid' | 'beacon' | 'flag';
}

export type StationKind =
  | 'task' | 'emergency' | 'cameras' | 'occupancy' | 'sabotage' | 'repair'
  | 'locker' | 'vent' | 'knife' | 'commsTerminal' | 'doorPanel'
  | 'wardrobe' | 'kiosk' | 'responsible' | 'shelf' | 'checkout';

export interface StationDef {
  id: string;
  level: string;
  x: number;
  y: number;
  kind: StationKind;
  name: string;
  /** Distancia de uso. */
  range?: number;
  /** Prop asociado (para resaltar). */
  prop?: string;
}

export interface VentDef {
  id: string;
  name: string;
  level: string;
  x: number;
  y: number;
  links: string[];
}

export interface CameraDef {
  id: string;
  name: string;
  level: string;
  x: number;
  y: number;
  /** Encuadre del mundo que muestra la cámara. */
  view: Rect;
}

export type TaskType =
  | 'orders' | 'cooking' | 'drink' | 'dishes' | 'toilet' | 'wiring' | 'fuses' | 'pressure'
  | 'filter' | 'assist' | 'luggage'
  | 'bilge' | 'seal' | 'ballast'
  | 'carts' | 'sorting' | 'cabinPressure';

export interface TaskSlotDef {
  id: string;
  type: TaskType;
  name: string;
  length: 'short' | 'long';
  exclusive?: boolean;
  /** Etapas: cada etapa ocurre en una de las estaciones candidatas. */
  stages: { stations: string[]; label: string }[];
}

export type SabotageKind = 'lights' | 'comms' | 'doors' | 'critical';

export interface RepairStepDef {
  stations: string[];
  minigame: string;
  label: string;
}

export interface SabotageDef {
  id: string;
  kind: SabotageKind;
  name: string;
  /** Estaciones donde el impostor prepara el sabotaje. */
  activation: string[];
  /** Pasos secuenciales de reparación. */
  repair: RepairStepDef[];
  /** Para críticos: textos y cinemática de fracaso. */
  failTitle?: string;
  failText?: string;
  failScene?: string;
  alarm?: string;
}

export interface DoorGroupDef {
  id: string;
  name: string;
  doors: string[];
}

export interface ZoneDef {
  id: string;
  name: string;
  level: string;
}

export interface InterferenceZoneDef {
  /** Terminal de comunicaciones que puede manipular el Interferente. */
  station: string;
  name: string;
  cameras: string[];
  zones: string[];
  stations: string[];
}

/** Tipos de etapa de la preparación del arma. */
export type KnifeStageKind = 'docs' | 'search' | 'tool' | 'compartment' | 'ledger' | 'keypad' | 'auth';

export interface KnifeTemplate {
  docName: string;
  keyName: string;
  toolName: string;
  compartmentName: string;
  ledgerName: string;
  containerName: string;
  authName: string;
  /** Estaciones candidatas por tipo de etapa (la cadena elige según dificultad). */
  pools: Record<KnifeStageKind, string[]>;
}

export interface NpcSeat {
  id: string;
  level: string;
  x: number;
  y: number;
  facing: 1 | -1;
  pose: 'sit' | 'stand';
  act: 'read' | 'window' | 'talk' | 'order' | 'sleep' | 'phone';
  /** Pasajero vinculado a estación de pedidos. */
  station?: string;
  /** Ruta de paseo ocasional (no cruza puertas cerrables). */
  walk?: Vec[];
}

export interface ResponsibleDef {
  title: string;
  name: string;
  level: string;
  room: string;
  patrol: Vec[];
}

export interface MapTexts {
  vehicle: string;
  short: string;
  description: string;
  routes: string;
  arrivalTitle: string;
  arrivalText: string;
  murderTitle: string;
  murderText: string;
  accessGoal: string;
  approach: string;
  ejectText: string;
}

export interface MapDef {
  id: AnyMapId;
  name: string;
  levels: LevelDef[];
  rooms: RoomDef[];
  walls: WallDef[];
  doors: DoorDef[];
  props: PropDef[];
  stations: StationDef[];
  vents: VentDef[];
  escapistLinks: [string, string][];
  cameras: CameraDef[];
  zones: ZoneDef[];
  doorGroups: DoorGroupDef[];
  interference: InterferenceZoneDef[];
  sabotages: SabotageDef[];
  tasks: TaskSlotDef[];
  knife?: KnifeTemplate;
  responsible?: ResponsibleDef;
  npcs: NpcSeat[];
  spawn: { level: string; x: number; y: number }[];
  safePoints: { level: string; x: number; y: number }[];
  meetingRoom: string;
  texts: MapTexts;
  /** Multiplicador de plazos críticos según distancias del mapa. */
  critTimeScale: number;
  theme: MapTheme;
  /** Datos propios del supermercado. */
  market?: MarketMapData;
}

export interface MarketSection {
  id: string;
  name: string;
  rect: Rect;
  icon: string;
}

export interface MarketMapData {
  checkout: string;
  /** Puntos de la cola junto a la caja, en orden. */
  queue: Vec[];
  /** Punto de escaneo frente al mostrador. */
  scanPoint: Vec;
  /** Salida de seguridad (secuencia de expulsión). */
  exitDoor: Vec;
  sections: MarketSection[];
  /** Productos expuestos en cada estantería (estación). */
  shelves: { station: string; section: string; products: string[] }[];
}

export interface MapTheme {
  scenery: 'sea' | 'sky' | 'terminal' | 'city';
  /** Colores base de la guía de arte. */
  bg: string;
  hull: string;
  hullDark: string;
  trim: string;
  wallTop: string;
  wallFace: string;
  wallFaceDark: string;
  accent: string;
  metal: string;
}
