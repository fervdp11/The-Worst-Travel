import Phaser from 'phaser';
import { INTERP_DELAY_MS, LOCKER_ANIM_MS, SIM_DT, VENT_ANIM_MS } from '../../shared/constants';
import { dist, dist2 } from '../../shared/geometry';
import { getMap, getRuntime } from '../../shared/maps';
import type { AnyMapId, CameraDef, MapDef, NpcSeat, PropDef, StationDef } from '../../shared/maps/types';
import { DoorState, MapRuntime } from '../../shared/maps/runtime';
import { propCollider, propOccluder, propShadow, propVisualRect } from '../../shared/maps/objects';
import { quantizeDir, stepMove } from '../../shared/movement';
import type { AnimCode, EntSnap, GameEvent, Snapshot } from '../../shared/protocol';
import { hashString } from '../../shared/rng';
import { AtlasBuilder } from '../art/Atlas';
import { CHUNK, CHUNK_MARGIN, MapPainter } from '../art/MapPainter';
import { PALETTES } from '../art/palette';
import { drawFlat, drawProp, PROP_PAD } from '../art/props';
import { generateScenery, sceneryColor, sceneryKeys } from '../art/scenery';
import { makeCanvas, rr, fillStroke, vgrad } from '../art/draw';
import { store } from '../state';
import { Character } from './Character';

const STEP_MS = SIM_DT * 1000;
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
/** Fracción del radio de visión donde empieza el desvanecimiento exterior. */
const VIS_INNER = 0.68;
/** Kinds de objetos planos que pueden ser objetivo de interacción (para su contorno). */
const FLAT_INTERACTIVE = new Set(['vent', 'hullPatch', 'hatch', 'serviceHatch']);

interface RemoteEnt {
  h: string;
  buf: { t: number; x: number; y: number; l: string; f: 1 | -1; a: AnimCode }[];
  last: EntSnap;
  char: Character;
  level: string;
  seenAt: number;
  gone: boolean;
  /** Última transición de ocultación vista (para animarla una sola vez). */
  hs: string | undefined;
  hide: HideAnim | null;
}

interface HideAnim { kind: 'vent' | 'locker'; from: number; to: number; start: number; dur: number }

interface Ambient {
  obj: Phaser.GameObjects.Image;
  kind: string;
  phase: number;
  level: string;
  baseX: number;
  baseY: number;
}

interface PropView {
  def: PropDef;
  img: Phaser.GameObjects.Image | null;
  key: string;
  frame: string;
  /** Copias teñidas para el contorno de silueta (se crean bajo demanda). */
  outline: Phaser.GameObjects.Image[] | null;
  visible: boolean;
}

export interface InteractInfo {
  station: StationDef | null;
  kind: 'use' | 'emergency' | 'vent' | 'locker' | 'sabotage' | 'door' | 'shelf' | 'checkout' | 'none';
  label: string;
  /** Verbo breve que se muestra en el botón: Usar, Reparar, Recoger, Entregar… */
  verb: string;
  doorId?: string;
  ventNear: string | null;
  sabotageStation: string | null;
  respNear: boolean;
  terminalNear: boolean;
  taskNear: boolean;
  /** Color del contorno: amarillo (trabajo/compra) o rojo (acción exclusiva del impostor). */
  color: number;
}

const NO_INTERACT: InteractInfo = { station: null, kind: 'none', label: '', verb: '', ventNear: null, sabotageStation: null, respNear: false, terminalNear: false, taskNear: false, color: 0 };
const YELLOW = 0xffd23f, RED = 0xff3b4f;

export class WorldScene extends Phaser.Scene {
  mapId: AnyMapId | null = null;
  def: MapDef | null = null;
  rt: MapRuntime | null = null;
  layers = new Map<string, Phaser.GameObjects.Layer>();
  bgLayer!: Phaser.GameObjects.Layer;
  fogLayer!: Phaser.GameObjects.Layer;
  private ownedTextures: string[] = [];
  private scenery: { ts: Phaser.GameObjects.TileSprite; speed: number; fy: number; par: number; alpha?: number }[] = [];
  private props: PropView[] = [];
  private stationProp = new Map<string, PropView>();
  private outlined: PropView | null = null;
  private doorImgs = new Map<string, Phaser.GameObjects.Image>();
  private ventLids = new Map<string, { lid: Phaser.GameObjects.Image; hole: Phaser.GameObjects.Image; tween: Phaser.Tweens.Tween | null; openUntil: number }>();
  private lockerDoors = new Map<string, { door: Phaser.GameObjects.Image; tween: Phaser.Tweens.Tween | null }>();
  private ambient: Ambient[] = [];
  private npcs: { seat: NpcSeat; char: Character; lenTotal: number }[] = [];
  ents = new Map<string, RemoteEnt>();
  // Niebla de visión a resolución de pantalla
  private fog: Phaser.GameObjects.RenderTexture | null = null;
  private brush: Phaser.GameObjects.RenderTexture | null = null;
  private visImg: Phaser.GameObjects.Image | null = null;
  private fogGfx!: Phaser.GameObjects.Graphics;
  private fogRes = 1;
  private poly: number[] = [];
  private polyTimer = 0;
  private camCam: Phaser.Cameras.Scene2D.Camera | null = null;
  private camDef: CameraDef | null = null;
  private camFog: Phaser.GameObjects.RenderTexture | null = null;
  private taskMarkers: Phaser.GameObjects.Image[] = [];
  private sensorImgs: Phaser.GameObjects.Image[] = [];
  private ledImgs = new Map<string, Phaser.GameObjects.Image>();
  private alarmLights: Phaser.GameObjects.Image[] = [];
  private debugGfx: Phaser.GameObjects.Graphics | null = null;
  private debugTexts: Phaser.GameObjects.Text[] = [];
  me: Character | null = null;
  private selfHide: HideAnim | null = null;
  private selfHs: string | undefined;
  // Predicción local
  pos = { x: 0, y: 0, px: 0, py: 0, ox: 0, oy: 0, level: '', facing: 1 as 1 | -1, acc: 0, seq: 0, speed: 190, st: 'free' as string, ghost: false, vis: 340 };
  pending: { s: number; dx: number; dy: number }[] = [];
  private outBuf: number[] = [];
  private outSeq = 0;
  private hasSelf = false;
  inputBlocked = false;
  freezeUntil = 0;
  touchDir = { x: 0, y: 0 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  doors: DoorState = { isClosed: (id) => store.pub?.closedDoors.includes(id) ?? false };
  mode: 'lobby' | 'game' = 'lobby';
  interact: InteractInfo = { ...NO_INTERACT };
  private lastTarget: string | null = null;
  private targetSince = 0;
  fps = 60;
  frameMs = 16;
  frameMax = 16;
  private camTarget = { x: 0, y: 0 };
  private loading = false;
  debug = false;
  private fxPool: Phaser.GameObjects.Image[] = [];
  private lastFrameAt = 0;
  private resizeHandler = () => this.onResize();

  constructor() {
    super('world');
  }

  create() {
    this.bgLayer = this.add.layer().setDepth(-100);
    this.fogLayer = this.add.layer().setDepth(100);
    this.fogGfx = this.make.graphics({}, false);
    this.cameras.main.setBackgroundColor('#141a2e');
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', false, false) as Record<string, Phaser.Input.Keyboard.Key>;
    kb.disableGlobalCapture();
    this.scale.on('resize', this.resizeHandler);
    this.makeVisionTexture();
    this.game.events.emit('world-ready', this);
  }

  /** Degradado radial inverso (0 en el centro → 1 en el borde) para el desvanecimiento de la visión. */
  private makeVisionTexture() {
    const key = 'fx_visinv';
    if (this.textures.exists(key)) return;
    const S = 512;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2);
      const k = d <= VIS_INNER ? 0 : d >= 1 ? 1 : (d - VIS_INNER) / (1 - VIS_INNER);
      const a = k * k * (3 - 2 * k);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
    ctx.putImageData(img, 0, 0);
    this.textures.addCanvas(key, c);
  }

  /** Visibilidad (0–1) en función de la distancia, con la misma curva que la textura. */
  private visAt(d: number): number {
    const r = this.pos.vis;
    const t = d / r;
    if (t <= VIS_INNER) return 1;
    if (t >= 1) return 0;
    const k = (t - VIS_INNER) / (1 - VIS_INNER);
    return 1 - k * k * (3 - 2 * k);
  }

  // ------------------------------------------------------------------ carga
  async loadMap(id: AnyMapId, mode: 'lobby' | 'game', onProgress: (p: number, label: string) => void) {
    if (this.loading) return;
    this.loading = true;
    try {
      this.unloadMap();
      this.mode = mode;
      this.mapId = id;
      this.def = getMap(id);
      this.rt = getRuntime(id);
      const def = this.def;
      const q = store.prefs.quality;
      const res = q === 'alto' ? 1.5 : q === 'medio' ? 1.25 : 1;
      const painter = new MapPainter(def, res);
      onProgress(0.03, 'Preparando el entorno…');
      generateScenery(this, id);
      this.ownedTextures.push(...sceneryKeys(id));
      await nextFrame();
      for (const lv of def.levels) this.layers.set(lv.id, this.add.layer());
      // Objetos con volumen: atlas compartido. Los planos interactivos también, solo para su contorno.
      const tall = def.props.filter((p) => !p.flat && p.kind !== 'railLine' && p.h > 0);
      const flatInt = def.props.filter((p) => p.flat && FLAT_INTERACTIVE.has(p.kind));
      const atlas = new AtlasBuilder(`atlas_${id}`, 2048);
      tall.forEach((p, i) => {
        const w = (p.rect.w + PROP_PAD * 2) * res, h = (p.rect.h + p.h + PROP_PAD * 2) * res;
        atlas.add(`prop${i}`, w, h, (ctx) => { ctx.scale(res, res); ctx.translate(PROP_PAD, PROP_PAD); drawProp(ctx, p, PALETTES[id], id); });
      });
      flatInt.forEach((p, i) => {
        atlas.add(`flat${i}`, (p.rect.w + PROP_PAD * 2) * res, (p.rect.h + PROP_PAD * 2) * res, (ctx) => {
          ctx.scale(res, res); ctx.translate(PROP_PAD - p.rect.x, PROP_PAD - p.rect.y); drawFlat(ctx, p, PALETTES[id]);
        });
      });
      onProgress(0.12, 'Montando el mobiliario…');
      await nextFrame();
      const frames = atlas.commit(this);
      this.ownedTextures.push(...atlas.keys());
      tall.forEach((p, i) => {
        const [key, frame] = frames.get(`prop${i}`)!;
        const img = this.add.image(p.rect.x - PROP_PAD, p.rect.y - p.h - PROP_PAD, key, frame).setOrigin(0, 0).setScale(1 / res);
        // Muebles siempre opacos: el orden de capas lo da la base frontal.
        img.setDepth(p.rect.y + p.rect.h);
        this.layers.get(p.level)!.add(img);
        this.props.push({ def: p, img, key, frame, outline: null, visible: true });
        if (p.anim) this.addAmbient(p);
      });
      flatInt.forEach((p, i) => {
        const [key, frame] = frames.get(`flat${i}`)!;
        this.props.push({ def: p, img: null, key, frame, outline: null, visible: true });
      });
      this.linkStations();
      // Fondo horneado (suelos, muros, sombras físicas)
      const jobs: { level: string; chunk: { x: number; y: number; w: number; h: number } }[] = [];
      for (const lv of def.levels) for (const c of painter.chunksFor(lv.id)) jobs.push({ level: lv.id, chunk: c });
      let done = 0;
      for (const j of jobs) {
        const canvas = painter.paintChunk(j.level, j.chunk, tall);
        const key = `chunk_${id}_${j.level}_${j.chunk.x}_${j.chunk.y}`;
        if (this.textures.exists(key)) this.textures.remove(key);
        this.textures.addCanvas(key, canvas);
        this.ownedTextures.push(key);
        const img = this.add.image(j.chunk.x - CHUNK_MARGIN, j.chunk.y - CHUNK_MARGIN, key).setOrigin(0, 0).setScale(1 / res).setDepth(-1e5);
        this.layers.get(j.level)!.add(img);
        done++;
        onProgress(0.15 + 0.7 * (done / jobs.length), `Construyendo el plano (${done}/${jobs.length})…`);
        await nextFrame();
      }
      if (id === 'plane') {
        const wings = MapPainter.paintWings(res * 0.6);
        const key = 'plane_wings';
        if (this.textures.exists(key)) this.textures.remove(key);
        this.textures.addCanvas(key, wings.canvas);
        this.ownedTextures.push(key);
        const img = this.add.image(wings.x, wings.y, key).setOrigin(0, 0).setScale(1 / (res * 0.6)).setDepth(-2e5);
        this.layers.get(def.levels[0].id)!.add(img);
      }
      onProgress(0.88, 'Colocando puertas, trampillas y taquillas…');
      this.buildDoors(res);
      this.buildVentLids(res);
      this.buildLockerDoors(res);
      this.buildScenery(id);
      this.buildNpcs();
      this.buildCameraLeds();
      for (let i = 0; i < 6; i++) { const m = this.add.image(0, 0, 'fx_hand').setScale(0.38).setVisible(false); this.fogLayer.add(m); this.taskMarkers.push(m); }
      this.createFog();
      this.updateLayerVisibility();
      onProgress(1, 'Listo');
    } finally {
      this.loading = false;
    }
  }

  /** Asocia cada estación al objeto que representa (para el contorno de silueta). */
  private linkStations() {
    this.stationProp.clear();
    for (const s of this.def!.stations) {
      let best: PropView | null = null;
      let bd = 90 * 90;
      for (const pv of this.props) {
        const p = pv.def;
        if (p.level !== s.level) continue;
        const r = p.rect;
        const cx = Math.max(r.x, Math.min(s.x, r.x + r.w)), cy = Math.max(r.y, Math.min(s.y, r.y + r.h));
        const d = dist2(cx, cy, s.x, s.y);
        if (d < bd) { bd = d; best = pv; }
      }
      if (best) this.stationProp.set(s.id, best);
    }
  }

  unloadMap() {
    this.closeCamera();
    for (const e of this.ents.values()) e.char.destroy();
    this.ents.clear();
    for (const n of this.npcs) n.char.destroy();
    this.npcs = [];
    this.me?.destroy();
    this.me = null;
    this.hasSelf = false;
    this.selfHide = null;
    this.selfHs = undefined;
    // Retira tweens y objetos de la partida anterior: nada sigue simulándose de fondo.
    this.tweens.killAll();
    for (const l of this.layers.values()) l.destroy(true);
    this.layers.clear();
    for (const s of this.scenery) s.ts.destroy();
    this.scenery = [];
    this.bgLayer?.removeAll(true);
    this.fogLayer?.removeAll(true);
    this.fog = null;
    this.brush?.destroy(); this.brush = null;
    this.visImg?.destroy(); this.visImg = null;
    for (const pv of this.props) pv.outline?.forEach((o) => o.destroy());
    this.props = [];
    this.stationProp.clear();
    this.outlined = null;
    this.doorImgs.clear();
    this.ventLids.clear();
    this.lockerDoors.clear();
    this.ambient = [];
    this.taskMarkers = [];
    this.sensorImgs = [];
    this.ledImgs.clear();
    this.alarmLights = [];
    this.fxPool = [];
    this.debugGfx = null;
    this.debugTexts = [];
    for (const k of this.ownedTextures) if (this.textures.exists(k)) this.textures.remove(k);
    this.ownedTextures = [];
    this.pending = [];
    this.outBuf = [];
    this.interact = { ...NO_INTERACT };
  }

  private buildDoors(res: number) {
    const def = this.def!;
    for (const d of def.doors) {
      if (!d.lockable) continue;
      const w = d.rect.w, h = d.rect.h;
      const c = makeCanvas((w + 4) * res, (h + 4) * res);
      const ctx = c.getContext('2d')!;
      ctx.scale(res, res);
      ctx.translate(2, 2);
      if (d.orient === 'h') {
        rr(ctx, 0, 0, w, h, 3); fillStroke(ctx, vgrad(ctx, 0, h, '#9aa5b1', '#5f6b7e'), '#1d1830', 2.5);
        ctx.save(); rr(ctx, 2, h - 9, w - 4, 7, 2); ctx.clip();
        for (let x = -10; x < w; x += 10) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, h - 9, 5, 7); ctx.fillStyle = '#1d1830'; ctx.fillRect(x + 5, h - 9, 5, 7); }
        ctx.restore();
        rr(ctx, w / 2 - 14, 10, 28, Math.max(8, h - 24), 4); fillStroke(ctx, '#a9d6e5', '#1d1830', 1.5);
      } else {
        rr(ctx, 0, 0, w, h, 3); fillStroke(ctx, vgrad(ctx, 0, h, '#9aa5b1', '#5f6b7e'), '#1d1830', 2.5);
        ctx.fillStyle = '#ffd23f'; for (let y = 6; y < h - 4; y += 14) ctx.fillRect(2, y, w - 4, 6);
      }
      const key = `door_${this.mapId}_${d.id}`;
      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addCanvas(key, c);
      this.ownedTextures.push(key);
      const img = this.add.image(d.rect.x - 2, d.rect.y - 2, key).setOrigin(0, 0).setScale(1 / res).setDepth(d.rect.y + d.rect.h).setVisible(false);
      this.layers.get(d.level)!.add(img);
      this.doorImgs.set(d.id, img);
    }
  }

  /** Tapa abatible y hueco de cada trampilla (se animan por evento, nunca por proximidad). */
  private buildVentLids(res: number) {
    const def = this.def!;
    for (const v of def.vents) {
      const p = def.props.find((x) => x.kind === 'vent' && x.level === v.level && Math.abs(x.rect.x + x.rect.w / 2 - v.x) < 30 && Math.abs(x.rect.y + x.rect.h / 2 - v.y) < 30);
      const w = p?.rect.w ?? 40, h = p?.rect.h ?? 30;
      const x = p ? p.rect.x : v.x - w / 2, y = p ? p.rect.y : v.y - h / 2;
      const keyL = `ventlid_${this.mapId}_${w}x${h}`, keyH = `venthole_${this.mapId}_${w}x${h}`;
      if (!this.textures.exists(keyL)) {
        const c = makeCanvas((w + 4) * res, (h + 4) * res); const ctx = c.getContext('2d')!; ctx.scale(res, res); ctx.translate(2, 2);
        drawFlat(ctx, { id: 'lid', level: '', kind: 'vent', rect: { x: 0, y: 0, w, h }, h: 2, solid: false, flat: true }, PALETTES[this.mapId!]);
        this.textures.addCanvas(keyL, c); this.ownedTextures.push(keyL);
        const c2 = makeCanvas((w + 4) * res, (h + 4) * res); const ctx2 = c2.getContext('2d')!; ctx2.scale(res, res); ctx2.translate(2, 2);
        rr(ctx2, 1, 1, w - 2, h - 2, 4); ctx2.fillStyle = '#07090f'; ctx2.fill();
        ctx2.fillStyle = 'rgba(255,255,255,0.06)'; ctx2.fillRect(4, 4, w - 8, 3);
        this.textures.addCanvas(keyH, c2); this.ownedTextures.push(keyH);
      }
      const hole = this.add.image(x - 2, y - 2, keyH).setOrigin(0, 0).setScale(1 / res).setDepth(-9e4).setVisible(false);
      const lid = this.add.image(x - 2 + (w + 4) / 2, y - 2, keyL).setOrigin(0.5, 0).setScale(1 / res).setDepth(-8.9e4);
      const layer = this.layers.get(v.level)!;
      layer.add(hole); layer.add(lid);
      this.ventLids.set(v.id, { lid, hole, tween: null, openUntil: 0 });
    }
  }

  /** Puerta de cada taquilla con bisagra lateral. */
  private buildLockerDoors(res: number) {
    for (const s of this.def!.stations) {
      if (s.kind !== 'locker') continue;
      const pv = this.stationProp.get(s.id);
      if (!pv || !pv.img) continue;
      const p = pv.def;
      const w = Math.min(p.rect.w, 52), h = p.h;
      const key = `lockerdoor_${this.mapId}_${s.id}`;
      const c = makeCanvas((w + 2) * res, (h + 2) * res); const ctx = c.getContext('2d')!; ctx.scale(res, res); ctx.translate(1, 1);
      rr(ctx, 0, 0, w, h, 3); fillStroke(ctx, vgrad(ctx, 0, h, '#c3ccd8', '#8a96a8'), '#1d1830', 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; for (let yy = 6; yy < 18; yy += 3) { ctx.beginPath(); ctx.moveTo(6, yy); ctx.lineTo(w - 6, yy); ctx.stroke(); }
      rr(ctx, w - 9, h * 0.45, 4, 10, 1.5); fillStroke(ctx, '#f1f3f5', '#1d1830', 1);
      this.textures.addCanvas(key, c); this.ownedTextures.push(key);
      // La puerta cubre la cara frontal; la bisagra está a la izquierda.
      const door = this.add.image(p.rect.x + (p.rect.w - w) / 2, p.rect.y + p.rect.h - h, key).setOrigin(0, 0).setScale(1 / res).setDepth(p.rect.y + p.rect.h + 0.5).setAlpha(0);
      this.layers.get(p.level)!.add(door);
      this.lockerDoors.set(s.id, { door, tween: null });
    }
  }

  /** Abre la tapa una vez y la cierra al terminar la transición. */
  private playLid(ventId: string | undefined, holdMs: number) {
    if (!ventId) return;
    const v = this.ventLids.get(ventId);
    if (!v) return;
    const now = performance.now();
    if (v.openUntil > now) { v.openUntil = Math.max(v.openUntil, now + holdMs); return; }
    v.openUntil = now + holdMs;
    v.tween?.stop();
    v.hole.setVisible(true);
    const quick = store.prefs.reduceMotion ? 60 : 140;
    v.tween = this.tweens.add({
      targets: v.lid, scaleY: v.lid.scaleX * 0.12, duration: quick, ease: 'Quad.easeOut',
      onComplete: () => {
        const wait = Math.max(0, v.openUntil - performance.now());
        v.tween = this.tweens.add({
          targets: v.lid, scaleY: v.lid.scaleX, duration: quick, delay: wait, ease: 'Quad.easeIn',
          onComplete: () => { v.hole.setVisible(false); v.tween = null; },
        });
      },
    });
  }

  /** Puerta de taquilla: abre girando sobre la bisagra y se cierra una sola vez. */
  private playLockerDoor(stId: string | undefined, holdMs: number) {
    if (!stId) return;
    const d = this.lockerDoors.get(stId);
    if (!d) return;
    d.tween?.stop();
    const sx = d.door.scaleY;
    d.door.setAlpha(1).setScale(sx, sx);
    const quick = store.prefs.reduceMotion ? 60 : 150;
    d.tween = this.tweens.add({
      targets: d.door, scaleX: sx * 0.12, duration: quick, ease: 'Quad.easeOut',
      onComplete: () => {
        d.tween = this.tweens.add({ targets: d.door, scaleX: sx, duration: quick, delay: holdMs, ease: 'Quad.easeIn', onComplete: () => { d.door.setAlpha(0); d.tween = null; } });
      },
    });
  }

  private addAmbient(p: PropDef) {
    const layer = this.layers.get(p.level)!;
    const cx = p.rect.x + p.rect.w / 2, top = p.rect.y - p.h;
    let img: Phaser.GameObjects.Image;
    switch (p.anim) {
      case 'blink': img = this.add.image(p.rect.x + 8 + (hashString(p.id) % Math.max(1, p.rect.w - 16)), p.rect.y + (p.rect.h < p.h ? p.rect.h + 6 : 6) - p.h, 'fx_light').setScale(0.08).setTint([0x3ddc97, 0xff4d5e, 0xffd23f][hashString(p.id) % 3]).setBlendMode(Phaser.BlendModes.ADD); break;
      case 'screen': img = this.add.image(cx, top + p.rect.h * 0.5 + 4, 'fx_light').setScale(Math.min(0.5, p.rect.w / 160), 0.18).setTint(0x5cc8ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3); break;
      case 'steam': case 'liquid': img = this.add.image(cx, top - 6, 'fx_puff').setScale(0.6).setAlpha(0.0); break;
      case 'fan': img = this.add.image(cx, top + p.rect.h / 2, 'fx_ring').setScale(0.35).setAlpha(0.25); break;
      case 'beacon': img = this.add.image(cx, top + 4, 'fx_light').setScale(0.3).setTint(0xff4d5e).setBlendMode(Phaser.BlendModes.ADD); break;
      case 'flag': case 'curtain': default: img = this.add.image(cx, top, 'fx_light').setScale(0.05).setAlpha(0); break;
    }
    img.setDepth(p.rect.y + p.rect.h + 1);
    layer.add(img);
    this.ambient.push({ obj: img, kind: p.anim!, phase: (hashString(p.id) % 1000) / 160, level: p.level, baseX: img.x, baseY: img.y });
  }

  private buildScenery(id: AnyMapId) {
    const add = (key: string, speed: number, fy: number, par = 1, alpha = 1, height?: number) => {
      const ts = this.add.tileSprite(0, 0, 100, height ?? 100, key).setOrigin(0, 0).setAlpha(alpha);
      this.bgLayer.add(ts);
      this.scenery.push({ ts, speed, fy, par, alpha });
    };
    const low = store.prefs.quality === 'bajo';
    if (id === 'ship') {
      add('sc_water', 70, 0, 1);
      if (!low) add('sc_waves', 150, 0, 1, 0.9);
      add('sc_islands', 30, 0, 0.6, 0.85);
      add('sc_foam', 160, 0, 1, 0.8, 256);
    } else if (id === 'plane') {
      add('sc_land', 40, 0, 0.35);
      add('sc_cloudlo', 230, 0, 0.7, 0.85);
      if (!low) add('sc_cloudhi', 420, 0, 1.2, 0.75);
    } else if (id === 'market') add('sc_city', 0, 0, 1);
    else add('sc_plaza', 0, 0, 1);
    this.cameras.main.setBackgroundColor(sceneryColor(id));
  }

  private buildNpcs() {
    const def = this.def!;
    for (const s of def.npcs) {
      const variant = hashString(s.id) % 8;
      const layer = this.layers.get(s.level)!;
      const char = new Character(this, layer, { kind: 'passenger', color: 0, acc: 9, name: '', variant });
      char.seated = s.pose === 'sit';
      char.setActivity(s.act);
      let len = 0;
      if (s.walk) for (let i = 0; i < s.walk.length; i++) { const a = s.walk[i], b = s.walk[(i + 1) % s.walk.length]; len += dist(a.x, a.y, b.x, b.y); }
      this.npcs.push({ seat: s, char, lenTotal: len });
    }
  }

  private buildCameraLeds() {
    for (const c of this.def!.cameras) {
      const img = this.add.image(c.x, c.y - 6, 'fx_light').setScale(0.12).setTint(0x3a3f4a).setDepth(c.y + 2);
      this.layers.get(c.level)!.add(img);
      this.ledImgs.set(c.id, img);
    }
  }

  // ------------------------------------------------------------------ niebla
  /** Resolución de la niebla: la misma que la pantalla (cada píxel de textura = un píxel visible). */
  private targetFogRes(): number {
    const cam = this.cameras.main;
    const q = store.prefs.quality;
    const cap = q === 'bajo' ? 0.75 : q === 'medio' ? 1.25 : 2;
    return Math.max(0.35, Math.min(cap, cam.zoom));
  }

  private createFog() {
    const cam = this.cameras.main;
    this.fogRes = this.targetFogRes();
    const w = Math.ceil((cam.width / cam.zoom + 96) * this.fogRes) + 8, h = Math.ceil((cam.height / cam.zoom + 96) * this.fogRes) + 8;
    if (this.fog) { this.fog.destroy(); this.fog = null; }
    if (this.brush) { this.brush.destroy(); this.brush = null; }
    this.fog = this.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setScale(1 / this.fogRes);
    this.fogLayer.addAt(this.fog, 0);
    this.brush = this.make.renderTexture({ x: 0, y: 0, width: w, height: h }, false).setOrigin(0, 0);
    if (!this.visImg) this.visImg = this.make.image({ key: 'fx_visinv' }, false).setOrigin(0.5, 0.5);
  }

  onResize() {
    this.applyZoom();
    if (this.def) this.createFog();
    if (this.camDef) this.positionCamCam();
  }

  applyZoom() {
    const cam = this.cameras.main;
    const viewH = this.mode === 'lobby' ? 720 : 640;
    const z = Math.min(cam.height / viewH, cam.width / 460);
    cam.setZoom(Math.max(0.4, z));
  }

  // ------------------------------------------------------------------ red
  onSnapshot(s: Snapshot) {
    if (!this.def || this.loading) return;
    store.syncGt(s.gt);
    if (s.me) this.reconcile(s.me);
    const seen = new Set<string>();
    const now = performance.now();
    for (const e of s.e) {
      seen.add(e.h);
      let ent = this.ents.get(e.h);
      const kind = e.k === 'r' ? 'responsible' : e.k === 'g' ? 'ghost' : 'player';
      if (!ent) {
        const layer = this.layers.get(e.l) ?? this.layers.values().next().value!;
        const char = new Character(this, layer, { kind, color: Math.max(0, e.c), acc: e.ac, name: e.n, map: this.mapId ?? 'ship' });
        char.alpha = 0;
        ent = { h: e.h, buf: [], last: e, char, level: e.l, seenAt: now, gone: false, hs: undefined, hide: null };
        this.ents.set(e.h, ent);
      }
      ent.gone = false;
      ent.seenAt = now;
      if (ent.level !== e.l) {
        const layer = this.layers.get(e.l);
        if (layer) ent.char.moveToLayer(layer);
        ent.level = e.l;
        ent.buf = [];
      }
      ent.char.setLook({ kind, color: Math.max(0, e.c), acc: e.ac, name: e.n, map: this.mapId ?? 'ship' });
      ent.char.carrying = !!e.tr;
      ent.char.bag = !!e.bg;
      ent.char.distort = !!e.dz;
      // Transición de ocultación vista por un testigo: se anima UNA vez por cambio de estado.
      if (e.hs !== ent.hs) {
        ent.hs = e.hs;
        if (e.hs === 'ventIn' || e.hs === 'lockerIn') {
          ent.hide = { kind: e.hs === 'ventIn' ? 'vent' : 'locker', from: 0, to: 1, start: now, dur: e.hs === 'ventIn' ? VENT_ANIM_MS : LOCKER_ANIM_MS };
          if (e.hs === 'ventIn') this.playLid(e.hst, VENT_ANIM_MS); else this.playLockerDoor(e.hst, LOCKER_ANIM_MS * 0.6);
        } else if (e.hs === 'ventOut' || e.hs === 'lockerOut') {
          ent.hide = { kind: e.hs === 'ventOut' ? 'vent' : 'locker', from: 1, to: 0, start: now, dur: e.hs === 'ventOut' ? VENT_ANIM_MS : LOCKER_ANIM_MS };
          if (e.hs === 'ventOut') this.playLid(e.hst, VENT_ANIM_MS); else this.playLockerDoor(e.hst, LOCKER_ANIM_MS * 0.6);
        }
      }
      ent.last = e;
      ent.buf.push({ t: s.t, x: e.x, y: e.y, l: e.l, f: e.f, a: e.a });
      if (ent.buf.length > 12) ent.buf.shift();
    }
    for (const ent of this.ents.values()) if (!seen.has(ent.h)) ent.gone = true;
  }

  private reconcile(me: NonNullable<Snapshot['me']>) {
    const rt = this.rt!;
    this.pos.speed = me.speed;
    this.pos.st = me.st;
    this.pos.vis = me.vis;
    this.pos.ghost = me.st === 'ghost';
    // Animación propia de trampilla/taquilla: dirigida por la transición confirmada.
    if (me.hs !== this.selfHs) {
      const now = performance.now();
      this.selfHs = me.hs;
      if (me.hs === 'ventIn') { this.selfHide = { kind: 'vent', from: 0, to: 1, start: now, dur: VENT_ANIM_MS }; this.playLid(me.hst, VENT_ANIM_MS); }
      else if (me.hs === 'ventOut') { this.selfHide = { kind: 'vent', from: 1, to: 0, start: now, dur: VENT_ANIM_MS }; this.playLid(me.hst, VENT_ANIM_MS); }
      else if (me.hs === 'lockerIn') { this.selfHide = { kind: 'locker', from: 0, to: 1, start: now, dur: LOCKER_ANIM_MS }; this.playLockerDoor(me.hst, LOCKER_ANIM_MS * 0.6); }
      else if (me.hs === 'lockerOut') { this.selfHide = { kind: 'locker', from: 1, to: 0, start: now, dur: LOCKER_ANIM_MS }; this.playLockerDoor(me.hst, LOCKER_ANIM_MS * 0.6); }
    }
    if (!me.hs && (me.st === 'vent' || me.st === 'locker') && !this.selfHide) this.selfHide = { kind: me.st === 'vent' ? 'vent' : 'locker', from: 1, to: 1, start: 0, dur: 1 };
    if (!me.hs && me.st !== 'vent' && me.st !== 'locker' && this.selfHide && this.selfHide.to === 1) this.selfHide = null;
    if (!this.hasSelf || me.l !== this.pos.level || !rt.levels.has(this.pos.level)) {
      this.hasSelf = true;
      this.pos.level = me.l;
      this.pos.x = this.pos.px = me.x;
      this.pos.y = this.pos.py = me.y;
      this.pos.ox = this.pos.oy = 0;
      this.pos.facing = me.f;
      this.pending = this.pending.filter((p) => p.s > me.ack);
      this.camTarget = { x: me.x, y: me.y };
      this.cameras.main.centerOn(me.x, me.y);
      this.ensureMe();
      this.updateLayerVisibility();
      return;
    }
    this.pending = this.pending.filter((p) => p.s > me.ack);
    let x = me.x, y = me.y;
    const ghost = me.st === 'ghost';
    const can = me.st === 'free' || ghost;
    if (can) for (const p of this.pending) { const r = stepMove(rt, me.l, x, y, p.dx, p.dy, me.speed, this.doors, ghost); x = r.x; y = r.y; }
    const ex = x - this.pos.x, ey = y - this.pos.y;
    if (Math.hypot(ex, ey) > 90) {
      this.pos.x = this.pos.px = x; this.pos.y = this.pos.py = y; this.pos.ox = this.pos.oy = 0;
    } else if (Math.abs(ex) > 0.01 || Math.abs(ey) > 0.01) {
      // Reconciliación suave: corrige la simulación y absorbe el salto visual.
      this.pos.x += ex; this.pos.y += ey; this.pos.px += ex; this.pos.py += ey;
      this.pos.ox -= ex; this.pos.oy -= ey;
    }
  }

  teleport(x: number, y: number, l: string) {
    this.pos.level = l;
    this.pos.x = this.pos.px = x;
    this.pos.y = this.pos.py = y;
    this.pos.ox = this.pos.oy = 0;
    this.pending = [];
    // La cámara se desplaza con una transición breve; el personaje no se interpola a través de muros.
    this.updateLayerVisibility();
  }

  private ensureMe() {
    const room = store.room;
    const pid = store.net?.pid;
    const lp = room?.players.find((p) => p.id === pid);
    const gp = store.pub?.players.find((p) => p.id === pid);
    const ghost = this.pos.ghost;
    const look = { kind: (ghost ? 'ghost' : 'player') as 'ghost' | 'player', color: gp?.color ?? lp?.color ?? 0, acc: gp?.acc ?? lp?.acc ?? 0, name: gp?.name ?? lp?.name ?? '' };
    const layer = this.layers.get(this.pos.level);
    if (!layer) return;
    if (!this.me) this.me = new Character(this, layer, look);
    else { this.me.setLook(look); this.me.moveToLayer(layer); }
  }

  refreshSelfLook() { if (this.me) this.ensureMe(); }

  updateLayerVisibility() {
    const main = this.cameras.main;
    for (const [id, layer] of this.layers) {
      if (id === this.pos.level) layer.cameraFilter &= ~main.id; else layer.cameraFilter |= main.id;
      if (this.camCam) { if (id === this.camDef?.level) layer.cameraFilter &= ~this.camCam.id; else layer.cameraFilter |= this.camCam.id; }
    }
    if (this.me) { const l = this.layers.get(this.pos.level); if (l) this.me.moveToLayer(l); }
  }

  onEvent(ev: GameEvent) {
    if (ev.e === 'teleport') this.teleport(ev.x, ev.y, ev.l);
    else if (ev.e === 'fx') this.spawnFx(ev.fx, ev.x, ev.y, ev.l);
  }

  private spawnFx(fx: string, x: number, y: number, l: string) {
    const layer = this.layers.get(l);
    if (!layer) return;
    const n = fx === 'sparkle' ? 6 : fx === 'sensor' ? 1 : 8;
    for (let i = 0; i < n; i++) {
      let img = this.fxPool.pop();
      if (!img || !img.scene) img = this.add.image(0, 0, 'fx_puff');
      layer.add(img);
      const key = fx === 'sparkle' || fx === 'decoy' ? 'fx_spark' : fx === 'sensor' ? 'fx_ring' : 'fx_puff';
      const tint = fx === 'decoy' ? 0x9ad1ff : fx === 'fade' || fx === 'unfade' ? 0xc8b6ff : fx === 'sensor' ? 0x3ddc97 : 0xffffff;
      img.setTexture(key).setTint(tint).setPosition(x, y - 20).setAlpha(0.9).setScale(0.5).setDepth(y + 5).setVisible(true);
      const a = (i / n) * Math.PI * 2;
      this.tweens.add({
        targets: img, x: x + Math.cos(a) * 26, y: y - 20 + Math.sin(a) * 18 - 10, alpha: 0, scale: fx === 'sensor' ? 1.6 : 0.9,
        duration: store.prefs.reduceMotion ? 250 : 480, ease: 'Quad.easeOut',
        onComplete: () => { img!.setVisible(false); this.fxPool.push(img!); },
      });
    }
  }

  // ------------------------------------------------------------------ cámaras de vigilancia
  showCamera(camId: string | null, viewport: { x: number; y: number; w: number; h: number } | null) {
    if (!camId || !viewport || !this.def) { this.closeCamera(); return; }
    const cd = this.def.cameras.find((c) => c.id === camId) ?? null;
    if (!cd) { this.closeCamera(); return; }
    this.camDef = cd;
    if (!this.camCam) {
      this.camCam = this.cameras.add(0, 0, 10, 10);
      this.camCam.setBackgroundColor('#0b0f18');
      this.camCam.ignore([this.bgLayer, this.fogLayer]);
    }
    this.camViewport = viewport;
    this.positionCamCam();
    if (this.camFog) this.camFog.destroy();
    const v = cd.view;
    this.camFog = this.add.renderTexture(v.x, v.y, Math.ceil(v.w), Math.ceil(v.h)).setOrigin(0, 0).setDepth(9e6);
    this.cameras.main.ignore(this.camFog);
    this.layers.get(cd.level)!.add(this.camFog);
    this.drawCamFog();
    this.updateLayerVisibility();
  }
  private camViewport: { x: number; y: number; w: number; h: number } | null = null;

  private positionCamCam() {
    if (!this.camCam || !this.camDef || !this.camViewport) return;
    const dpr = (this.game.registry.get('dpr') as number) ?? 1;
    const vp = this.camViewport;
    this.camCam.setViewport(vp.x * dpr, vp.y * dpr, vp.w * dpr, vp.h * dpr);
    const v = this.camDef.view;
    this.camCam.setZoom(Math.min((vp.w * dpr) / v.w, (vp.h * dpr) / v.h));
    this.camCam.centerOn(v.x + v.w / 2, v.y + v.h / 2);
  }

  private drawCamFog() {
    if (!this.camFog || !this.camDef || !this.rt) return;
    const cd = this.camDef;
    const poly = this.rt.visibility(cd.level, cd.x, cd.y + 4, 900, this.doors, [], 180);
    const g = this.fogGfx;
    this.camFog.clear();
    this.camFog.fill(0x05070d, 0.9);
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    for (let i = 0; i < poly.length; i += 2) {
      const px = poly[i] - cd.view.x, py = poly[i + 1] - cd.view.y;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
    this.camFog.erase(g, 0, 0);
  }

  closeCamera() {
    if (this.camCam) { this.cameras.remove(this.camCam, true); this.camCam = null; }
    if (this.camFog) { this.camFog.destroy(); this.camFog = null; }
    this.camDef = null;
    this.camViewport = null;
    if (this.layers.size) this.updateLayerVisibility();
  }

  // ------------------------------------------------------------------ depuración
  /**
   * F3: contorno visual (blanco), colisión (verde), oclusor de visión (magenta),
   * sombra física (azul), muros (rojo si ocluyen, naranja si no), puertas (azul claro).
   */
  toggleDebug() {
    this.debug = !this.debug;
    if (this.debugGfx) { this.debugGfx.destroy(); this.debugGfx = null; }
    for (const t of this.debugTexts) t.destroy();
    this.debugTexts = [];
    if (!this.debug || !this.def) return;
    const g = this.add.graphics().setDepth(5e7);
    const def = this.def;
    const lv = def.levels.find((l) => l.id === this.pos.level) ?? def.levels[0];
    g.lineStyle(2, 0x00ffff, 0.9);
    for (const poly of lv.outline) { g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.strokePath(); }
    for (const w of def.walls) {
      if (w.level !== lv.id) continue;
      g.lineStyle(1, w.occludes ? 0xff3355 : 0xffaa00, 0.9);
      if (w.seg) { g.lineBetween(w.seg.ax, w.seg.ay, w.seg.bx, w.seg.by); } else g.strokeRect(w.rect.x, w.rect.y, w.rect.w, w.rect.h);
    }
    for (const p of def.props) {
      if (p.level !== lv.id || p.kind === 'railLine') continue;
      const v = propVisualRect(p);
      g.lineStyle(1, 0xffffff, 0.55); g.strokeRect(v.x, v.y, v.w, v.h);
      const sh = propShadow(p);
      if (sh !== 'none' && sh !== 'wall') { g.lineStyle(1, 0x4d7cff, 0.9); g.strokeRect(p.rect.x + 3, p.rect.y + 3, p.rect.w, p.rect.h); }
      const c = propCollider(p);
      if (c) { g.lineStyle(2, 0x39ff6a, 0.95); g.strokeRect(c.x, c.y, c.w, c.h); }
      const o = propOccluder(p);
      if (o) { g.lineStyle(2, 0xff3df2, 0.95); g.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2); }
    }
    for (const d of def.doors) if (d.level === lv.id) { g.lineStyle(2, 0x3399ff, 0.9); g.strokeRect(d.rect.x, d.rect.y, d.rect.w, d.rect.h); }
    for (const s of def.stations) if (s.level === lv.id) { g.lineStyle(1, 0xffffff, 0.5); g.strokeCircle(s.x, s.y, 4); }
    for (const r of def.rooms) if (r.level === lv.id) {
      g.lineStyle(1, 0xffffff, 0.25); g.strokeRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h);
      const t = this.add.text(r.rect.x + 4, r.rect.y + 4, `${r.id}`, { fontSize: '12px', color: '#00ffff', fontFamily: 'monospace' }).setDepth(5e7);
      this.layers.get(lv.id)!.add(t);
      this.debugTexts.push(t);
    }
    this.layers.get(lv.id)!.add(g);
    this.debugGfx = g;
  }

  // ------------------------------------------------------------------ bucle
  private readInput(): { x: number; y: number } {
    if (this.inputBlocked) return { x: 0, y: 0 };
    const k = this.keys;
    let x = 0, y = 0;
    if (k.A.isDown || k.LEFT.isDown) x -= 1;
    if (k.D.isDown || k.RIGHT.isDown) x += 1;
    if (k.W.isDown || k.UP.isDown) y -= 1;
    if (k.S.isDown || k.DOWN.isDown) y += 1;
    if (this.touchDir.x || this.touchDir.y) { x = this.touchDir.x; y = this.touchDir.y; }
    return { x, y };
  }

  private localCanMove() {
    if (performance.now() < this.freezeUntil) return false;
    const phase = store.pub?.phase;
    if (this.mode === 'game' && phase !== 'EXPLORACION' && phase !== 'COMPRA') return false;
    if (store.panel && store.panel.kind !== 'observer') return false;
    return this.pos.st === 'free' || this.pos.st === 'ghost';
  }

  /** En la caja del supermercado todos miran la misma escena. */
  private sharedView(): boolean {
    return this.mode === 'game' && store.pub?.mode === 'market' && store.pub.phase !== 'COMPRA' && store.pub.phase !== 'INICIO';
  }

  override update() {
    // Tiempo real medido aquí: el delta suavizado del motor no debe frenar la simulación.
    const nowReal = performance.now();
    const delta = Math.min(500, this.lastFrameAt ? nowReal - this.lastFrameAt : 16.7);
    this.lastFrameAt = nowReal;
    this.frameMs = this.frameMs * 0.9 + delta * 0.1;
    this.frameMax = Math.max(delta, this.frameMax * 0.995);
    this.fps = 1000 / Math.max(1, this.frameMs);
    if (!this.def || this.loading || !this.rt) return;
    const now = performance.now();
    const net = store.net;
    if (!this.hasSelf || !this.rt.levels.has(this.pos.level)) { this.updateScenery(now); return; }
    // --- paso fijo de simulación local
    this.pos.acc += delta;
    const can = this.localCanMove() && this.hasSelf;
    while (this.pos.acc >= STEP_MS) {
      this.pos.acc -= STEP_MS;
      this.pos.px = this.pos.x; this.pos.py = this.pos.y;
      const inp = this.readInput();
      const [qx, qy] = quantizeDir(inp.x, inp.y);
      if (can && (qx || qy)) {
        if (qx > 10) this.pos.facing = 1; else if (qx < -10) this.pos.facing = -1;
        const r = stepMove(this.rt, this.pos.level, this.pos.x, this.pos.y, qx, qy, this.pos.speed, this.doors, this.pos.ghost);
        this.pos.x = r.x; this.pos.y = r.y;
      }
      if (this.hasSelf) {
        const s = ++this.pos.seq;
        const dx = can ? qx : 0, dy = can ? qy : 0;
        this.pending.push({ s, dx, dy });
        if (this.pending.length > 120) this.pending.shift();
        if (!this.outBuf.length) this.outSeq = s;
        this.outBuf.push(dx, dy);
        if (this.outBuf.length >= 4 && net) { net.emit('inp', { s: this.outSeq, d: this.outBuf }); this.outBuf = []; }
      }
    }
    const alpha = this.pos.acc / STEP_MS;
    const decay = Math.exp(-delta / 70);
    this.pos.ox *= decay; this.pos.oy *= decay;
    const rx = this.pos.px + (this.pos.x - this.pos.px) * alpha + this.pos.ox;
    const ry = this.pos.py + (this.pos.y - this.pos.py) * alpha + this.pos.oy;
    // --- cámara: suavizado separado de la posición física (sin inercia al detenerse)
    const cam = this.cameras.main;
    let tx = rx, ty = ry;
    if (this.sharedView() && this.def.market) { tx = this.def.market.scanPoint.x - 120; ty = this.def.market.scanPoint.y - 40; }
    const k = 1 - Math.exp(-delta / (this.sharedView() ? 260 : 45));
    this.camTarget.x += (tx - this.camTarget.x) * k;
    this.camTarget.y += (ty - this.camTarget.y) * k;
    if (Math.hypot(tx - this.camTarget.x, ty - this.camTarget.y) < 0.2) { this.camTarget.x = tx; this.camTarget.y = ty; }
    let shakeX = 0, shakeY = 0, rot = 0;
    const tSec = now / 1000;
    if (store.prefs.shake && !store.prefs.reduceMotion && this.mode === 'game') {
      if (this.mapId === 'ship') rot = Math.sin(tSec * 0.55) * 0.0035;
      else if (this.mapId === 'plane') { const tb = Math.max(0, Math.sin(tSec * 0.21) - 0.85) * 6; shakeX = Math.sin(tSec * 23) * tb; shakeY = Math.cos(tSec * 19) * tb; }
    }
    const lb = this.rt.level(this.pos.level).hullBox;
    const halfW = cam.width / cam.zoom / 2, halfH = cam.height / cam.zoom / 2;
    const cx = Phaser.Math.Clamp(this.camTarget.x, lb.x - 200 + halfW * 0.3, lb.x + lb.w + 200 - halfW * 0.3);
    const cy = Phaser.Math.Clamp(this.camTarget.y, lb.y - 200 + Math.min(halfH, 300), lb.y + lb.h + 200 - Math.min(halfH, 300));
    cam.centerOn(cx + shakeX, cy + shakeY);
    cam.setRotation(rot);
    // --- yo
    if (this.me) {
      const anim: AnimCode = this.pos.st === 'panel' ? 'task' : this.pos.st === 'cams' || this.pos.st === 'observing' ? 'cams' : this.pos.st === 'sabotaging' ? 'repair' : this.pos.st === 'attacking' ? 'attack' : 'walk';
      this.me.targetAlpha = store.priv?.invisible ? 0.4 : 1;
      this.me.carrying = !!store.priv?.carrying && store.pub?.mode !== 'market';
      this.me.bag = !!store.priv?.market?.carrying;
      this.me.nameColor = store.priv?.team === 'impostor' ? '#ff5a6a' : null;
      this.applyHide(this.me, this.selfHide, now);
      this.me.update(delta, rx, ry, this.pos.facing, anim, now);
    }
    this.updateEntities(delta, now, rx, ry);
    this.updateNpcs(delta, now, rx, ry);
    this.updateScenery(now);
    this.updateAmbient(now, cam);
    this.updateDoors();
    this.updateWorldMarkers(now, rx, ry);
    this.computeInteract(rx, ry);
    this.updateOutline();
    this.updateFog(rx, ry);
    if (this.camDef && (this.polyTimer % 8 === 0)) this.drawCamFog();
  }

  private applyHide(c: Character, h: HideAnim | null, now: number) {
    if (!h) { c.hidden = 0; return; }
    const k = h.dur <= 1 ? 1 : Math.min(1, (now - h.start) / h.dur);
    c.hideKind = h.kind;
    c.hidden = h.from + (h.to - h.from) * k;
  }

  private seesLocal(x: number, y: number, l: string, rx: number, ry: number): boolean {
    if (this.mode === 'lobby' || this.pos.ghost || this.sharedView()) return l === this.pos.level;
    if (l !== this.pos.level) return false;
    if (dist2(rx, ry, x, y) > this.pos.vis * this.pos.vis) return false;
    return this.rt!.los(l, rx, ry - 8, x, y - 8, this.doors);
  }

  private updateEntities(delta: number, now: number, rx: number, ry: number) {
    const net = store.net;
    const renderT = (net ? net.serverNow() : Date.now()) - INTERP_DELAY_MS;
    for (const [h, ent] of this.ents) {
      if (ent.gone && now - ent.seenAt > 400) { ent.char.destroy(); this.ents.delete(h); continue; }
      const b = ent.buf;
      if (!b.length) continue;
      let x = b[b.length - 1].x, y = b[b.length - 1].y, f = b[b.length - 1].f, a = b[b.length - 1].a;
      for (let i = b.length - 1; i > 0; i--) {
        if (b[i - 1].t <= renderT && b[i].t >= renderT) {
          const t = (renderT - b[i - 1].t) / Math.max(1, b[i].t - b[i - 1].t);
          x = b[i - 1].x + (b[i].x - b[i - 1].x) * t;
          y = b[i - 1].y + (b[i].y - b[i - 1].y) * t;
          f = t < 0.5 ? b[i - 1].f : b[i].f;
          a = b[i].a;
          break;
        }
        if (i === 1 && renderT < b[0].t) { x = b[0].x; y = b[0].y; f = b[0].f; a = b[0].a; }
      }
      const viaCam = !!ent.last.cam;
      const visible = !ent.gone && (viaCam || this.seesLocal(x, y, ent.level, rx, ry));
      ent.char.targetAlpha = visible ? 1 : 0;
      if (ent.hide && !ent.hs && ent.hide.to === 0 && now - ent.hide.start > ent.hide.dur) ent.hide = null;
      this.applyHide(ent.char, ent.hide, now);
      ent.char.update(delta, x, y, f, a, now);
    }
  }

  private updateNpcs(delta: number, now: number, rx: number, ry: number) {
    const cam = this.cameras.main;
    const view = cam.worldView;
    const t = (store.net ? store.net.serverNow() : Date.now()) / 1000;
    for (const n of this.npcs) {
      const s = n.seat;
      let x = s.x, y = s.y, f = s.facing as 1 | -1;
      let moving = false;
      if (s.walk && n.lenTotal > 0) {
        const speed = 38, pause = 6;
        const period = n.lenTotal / speed + pause * s.walk.length;
        let tt = (t + (hashString(s.id) % 100)) % period;
        for (let i = 0; i < s.walk.length; i++) {
          if (tt < pause) { x = s.walk[i].x; y = s.walk[i].y; break; }
          tt -= pause;
          const a = s.walk[i], b = s.walk[(i + 1) % s.walk.length];
          const seg = dist(a.x, a.y, b.x, b.y) / speed;
          if (tt < seg) { const k = tt / seg; x = a.x + (b.x - a.x) * k; y = a.y + (b.y - a.y) * k; f = b.x >= a.x ? 1 : -1; moving = true; break; }
          tt -= seg;
        }
      }
      const inView = s.level === this.pos.level && x > view.x - 80 && x < view.right + 80 && y > view.y - 80 && y < view.bottom + 120;
      if (!inView) { n.char.root.setVisible(false); n.char.nameText.setVisible(false); continue; }
      n.char.targetAlpha = this.seesLocal(x, y, s.level, rx, ry) ? 1 : 0;
      n.char.update(delta, x, y, f, moving ? 'walk' : 'idle', now);
    }
  }

  private updateScenery(now: number) {
    const cam = this.cameras.main;
    const v = cam.worldView;
    const t = now / 1000;
    const slow = store.prefs.reduceMotion ? 0.35 : 1;
    const pad = 300;
    for (const s of this.scenery) {
      const ts = s.ts;
      ts.setPosition(v.x - pad, v.y - pad);
      ts.setSize(v.width + pad * 2, ts.texture.key === 'sc_foam' ? ts.height : v.height + pad * 2);
      const key = ts.texture.key;
      if (key === 'sc_foam') { ts.setPosition(Math.max(v.x - pad, 3380), 430); ts.setSize(Math.max(10, v.right + pad - Math.max(v.x - pad, 3380)), 256); }
      ts.tilePositionX = (v.x - pad) * s.par - t * s.speed * slow;
      ts.tilePositionY = key === 'sc_foam' ? 0 : (v.y - pad) * s.par + (key === 'sc_waves' ? Math.sin(t * 0.8) * 6 : 0);
    }
    if (this.mapId === 'plane') {
      // Paso suave del día al atardecer
      const k = (Math.sin((t / 360) * Math.PI * 2) + 1) / 2;
      const tint = lerpColor(0xffffff, 0xffb98a, k * 0.85);
      for (const s of this.scenery) s.ts.setTint(tint);
    }
  }

  private updateAmbient(now: number, cam: Phaser.Cameras.Scene2D.Camera) {
    const t = now / 1000;
    const v = cam.worldView;
    const fx = store.prefs.effects;
    for (const a of this.ambient) {
      if (a.level !== this.pos.level) continue;
      if (a.baseX < v.x - 100 || a.baseX > v.right + 100 || a.baseY < v.y - 150 || a.baseY > v.bottom + 150) continue;
      const p = t + a.phase;
      switch (a.kind) {
        case 'blink': a.obj.setAlpha(Math.sin(p * 3.1) > 0.2 ? 0.95 * fx : 0.15); break;
        case 'screen': a.obj.setAlpha((0.22 + Math.sin(p * 9) * 0.04 + (Math.sin(p * 0.7) > 0.95 ? 0.15 : 0)) * fx); break;
        case 'steam': case 'liquid': { const c = (p * 0.6) % 1; a.obj.setPosition(a.baseX + Math.sin(p * 2) * 4, a.baseY - c * 30).setAlpha((1 - c) * 0.55 * fx).setScale(0.4 + c * 0.6); break; }
        case 'fan': a.obj.setRotation(p * 8).setAlpha(0.2 * fx); break;
        case 'beacon': a.obj.setAlpha((0.4 + Math.sin(p * 4) * 0.35) * fx); break;
        default: break;
      }
    }
  }

  private updateDoors() {
    const closed = store.pub?.closedDoors;
    for (const [id, img] of this.doorImgs) img.setVisible(!!closed?.includes(id));
    const leds = store.pub?.camLeds ?? [];
    for (const [id, img] of this.ledImgs) img.setTint(leds.includes(id) ? 0xff2d3d : 0x3a3f4a).setAlpha(leds.includes(id) ? 0.95 : 0.6);
  }

  /**
   * Indicadores de tareas propias: cada uno se vincula por ID a una tarea vigente
   * y a una estación real del mapa actual; si la relación falla, no se dibuja nada.
   */
  private updateWorldMarkers(now: number, rx: number, ry: number) {
    const priv = store.priv;
    const tasks = this.mode === 'game' && store.pub?.mode === 'travel' ? priv?.tasks.filter((t) => !t.done && t.station) ?? [] : [];
    let k = 0;
    for (const t of tasks) {
      if (k >= this.taskMarkers.length) break;
      const s = this.rt!.stations.get(t.station!);
      if (!s) { if (this.debug) console.warn('Marcador sin estación', t.id, t.station); continue; }
      if (s.level !== this.pos.level || !this.seesLocal(s.x, s.y, s.level, rx, ry)) continue;
      const pv = this.stationProp.get(s.id);
      const top = pv ? pv.def.rect.y - (pv.def.flat ? 0 : pv.def.h) - 18 : s.y - 52;
      const mx = pv ? pv.def.rect.x + pv.def.rect.w / 2 : s.x;
      this.taskMarkers[k++].setVisible(true).setPosition(mx, top + Math.sin(now / 250) * 3).setDepth(1e7);
    }
    for (; k < this.taskMarkers.length; k++) this.taskMarkers[k].setVisible(false);
    // Sensores visibles
    const sensors = store.pub?.sensors ?? [];
    while (this.sensorImgs.length < sensors.length) { const img = this.add.image(0, 0, 'fx_light').setScale(0.14).setTint(0x3ddc97).setBlendMode(Phaser.BlendModes.ADD); this.sensorImgs.push(img); }
    this.sensorImgs.forEach((img, i) => {
      const s = sensors[i];
      if (!s || s.l !== this.pos.level) { img.setVisible(false); return; }
      const layer = this.layers.get(s.l);
      if (layer && !layer.exists(img)) layer.add(img);
      img.setVisible(this.seesLocal(s.x, s.y, s.l, rx, ry)).setPosition(s.x, s.y - 30).setAlpha(0.5 + Math.sin(now / 200) * 0.4).setDepth(s.y + 1);
    });
    // Luces de alarma en reparaciones activas
    const sab = store.pub?.sabotage;
    const steps = sab && sab.kind !== 'doors' ? sab.steps[sab.step]?.stations ?? [] : [];
    while (this.alarmLights.length < steps.length) { const img = this.add.image(0, 0, 'fx_light').setScale(0.9).setTint(0xff2d3d).setBlendMode(Phaser.BlendModes.ADD); this.alarmLights.push(img); }
    this.alarmLights.forEach((img, i) => {
      const sid = steps[i];
      const s = sid ? this.rt!.stations.get(sid) : undefined;
      if (!s || s.level !== this.pos.level) { img.setVisible(false); return; }
      const layer = this.layers.get(s.level)!;
      if (!layer.exists(img)) layer.add(img);
      // Aviso contenido: pulso suave, sin destellos agresivos.
      img.setVisible(true).setPosition(s.x, s.y - 20).setDepth(s.y + 2).setAlpha((0.28 + Math.sin(now / 420) * 0.12) * store.prefs.effects);
    });
  }

  /** Interacción contextual disponible (el servidor la valida igualmente). */
  private computeInteract(rx: number, ry: number) {
    const info: InteractInfo = { ...NO_INTERACT };
    const rt = this.rt!;
    const priv = store.priv;
    const pub = store.pub;
    const pick = () => {
      // Objetivo estable: no salta entre dos objetos cercanos por un píxel de diferencia.
      const id = info.station?.id ?? null;
      if (id !== this.lastTarget) { this.lastTarget = id; this.targetSince = performance.now(); }
      this.interact = info;
    };
    if (this.mode === 'lobby') {
      const s = rt.stationsNear(this.pos.level, rx, ry, 80)[0];
      if (s && rt.los(s.level, rx, ry - 4, s.x, s.y - 4, this.doors)) { info.station = s; info.kind = 'use'; info.label = s.name; info.verb = 'Usar'; info.color = YELLOW; }
      pick(); return;
    }
    if (!priv || !pub || (pub.phase !== 'EXPLORACION' && pub.phase !== 'COMPRA') || store.panel) { pick(); return; }
    const alive = !this.pos.ghost;
    if (pub.mode === 'market') {
      if (!alive || this.pos.st !== 'free') { pick(); return; }
      const carrying = priv.market?.carrying ?? null;
      let best: StationDef | null = null;
      for (const s of rt.stationsNear(this.pos.level, rx, ry, 96)) {
        if (!rt.los(s.level, rx, ry - 4, s.x, s.y - 4, this.doors)) continue;
        if (s.kind === 'checkout' && !carrying) continue;
        if (s.kind === 'shelf' || s.kind === 'checkout') { best = s; break; }
      }
      if (best) {
        info.station = best;
        info.kind = best.kind === 'checkout' ? 'checkout' : 'shelf';
        info.verb = best.kind === 'checkout' ? 'Entregar' : carrying ? 'Devolver' : 'Recoger';
        info.label = best.name;
        info.color = YELLOW; // la compra es la misma acción para todos: nunca roja
      }
      pick(); return;
    }
    const isImp = priv.team === 'impostor';
    const stations = rt.stationsNear(this.pos.level, rx, ry);
    const sabStep = pub.sabotage && pub.sabotage.kind !== 'doors' ? pub.sabotage.steps[pub.sabotage.step] : null;
    const myTaskStations = new Set(priv.tasks.filter((t) => !t.done && t.station).map((t) => t.station!));
    const knifeSt = new Set(priv.knife?.hints.map((h) => h.id) ?? []);
    let best: { s: StationDef; kind: InteractInfo['kind']; label: string; verb: string; color: number } | null = null;
    for (const s of stations) {
      if (!rt.los(s.level, rx, ry - 4, s.x, s.y - 4, this.doors)) continue;
      let c: { kind: InteractInfo['kind']; label: string; verb: string; color: number } | null = null;
      switch (s.kind) {
        case 'task': case 'repair':
          if (alive && sabStep?.stations.includes(s.id)) c = { kind: 'use', label: s.name, verb: 'Reparar', color: YELLOW };
          else if (myTaskStations.has(s.id)) { c = { kind: 'use', label: s.name, verb: 'Usar', color: YELLOW }; info.taskNear = true; }
          break;
        case 'emergency': if (alive) c = { kind: 'emergency', label: 'Convocar reunión', verb: 'Reunión', color: YELLOW }; break;
        case 'vent': if (alive && (isImp || priv.role === 'ingeniero')) { info.ventNear = s.id; c = { kind: 'vent', label: 'Trampilla', verb: 'Entrar', color: isImp ? RED : YELLOW }; } break;
        case 'locker': if (alive) c = { kind: 'locker', label: s.name, verb: 'Ocultarse', color: YELLOW }; break;
        case 'cameras': case 'occupancy': if (alive) c = { kind: 'use', label: s.name, verb: 'Usar', color: YELLOW }; break;
        case 'sabotage': if (alive && (isImp || store.room?.practice)) { info.sabotageStation = s.id; c = { kind: 'sabotage', label: s.name, verb: 'Preparar sabotaje', color: RED }; } break;
        case 'knife': if (alive && isImp && knifeSt.has(s.id)) c = { kind: 'use', label: s.name, verb: 'Registrar', color: RED }; break;
        case 'commsTerminal': if (alive && priv.role === 'interferente') info.terminalNear = true; break;
        default: break;
      }
      if (!c) continue;
      // Prioridad estable: se conserva el objetivo actual si sigue siendo válido y cercano.
      const d = dist2(s.x, s.y, rx, ry) - (s.id === this.lastTarget ? 900 : 0);
      if (!best || d < dist2(best.s.x, best.s.y, rx, ry) - (best.s.id === this.lastTarget ? 900 : 0)) best = { s, ...c };
    }
    if (alive && pub.closedDoors.length && !best) {
      for (const id of pub.closedDoors) {
        const d = rt.doors.get(id);
        if (!d || d.level !== this.pos.level) continue;
        if (dist(rx, ry, d.rect.x + d.rect.w / 2, d.rect.y + d.rect.h / 2) < 90) { info.kind = 'door'; info.doorId = id; info.label = 'Apertura de seguridad'; info.verb = 'Abrir'; break; }
      }
    }
    if (best) { info.station = best.s; info.kind = best.kind; info.label = best.label; info.verb = best.verb; info.color = best.color; }
    if (isImp && alive && priv.knife?.hasKnife && priv.knife.authorized) {
      for (const e of this.ents.values()) if (e.last.k === 'r' && e.level === this.pos.level && dist(e.last.x, e.last.y, rx, ry) < 74) info.respNear = true;
    }
    pick();
  }

  /** Contorno fino que sigue la silueta del objeto (sin aros ni discos bajo él). */
  private updateOutline() {
    const s = this.interact.station;
    const pv = s ? this.stationProp.get(s.id) ?? null : null;
    const color = this.interact.color;
    if (this.outlined && this.outlined !== pv) { this.outlined.outline?.forEach((o) => o.setVisible(false)); this.outlined = null; }
    if (!pv || !color) return;
    if (!pv.outline) {
      const layer = this.layers.get(pv.def.level)!;
      const res = store.prefs.quality === 'alto' ? 1.5 : store.prefs.quality === 'medio' ? 1.25 : 1;
      const p = pv.def;
      const baseX = p.rect.x - PROP_PAD, baseY = p.flat ? p.rect.y - PROP_PAD : p.rect.y - p.h - PROP_PAD;
      const depth = p.flat ? -8.8e4 : p.rect.y + p.rect.h - 0.01;
      pv.outline = [];
      for (let i = 0; i < 8; i++) {
        const o = this.add.image(baseX, baseY, pv.key, pv.frame).setOrigin(0, 0).setScale(1 / res).setDepth(depth).setVisible(false);
        o.setData('a', (i / 8) * Math.PI * 2);
        layer.add(o);
        pv.outline.push(o);
      }
      if (p.flat) {
        // El objeto plano vuelve a dibujarse encima de su contorno.
        const top = this.add.image(baseX, baseY, pv.key, pv.frame).setOrigin(0, 0).setScale(1 / res).setDepth(depth + 0.001).setVisible(false);
        top.setData('top', true);
        layer.add(top);
        pv.outline.push(top);
      }
    }
    // Grosor constante en pantalla, independiente del zoom.
    const off = 1.7 / this.cameras.main.zoom;
    const p = pv.def;
    const baseX = p.rect.x - PROP_PAD, baseY = p.flat ? p.rect.y - PROP_PAD : p.rect.y - p.h - PROP_PAD;
    for (const o of pv.outline) {
      if (o.getData('top')) { o.setVisible(true).setPosition(baseX, baseY); continue; }
      const a = o.getData('a') as number;
      o.setTintFill(color).setVisible(true).setAlpha(0.95).setPosition(baseX + Math.cos(a) * off, baseY + Math.sin(a) * off);
    }
    this.outlined = pv;
  }

  /**
   * Niebla de visión. Composición: (1) se rellena; (2) se prepara un pincel con
   * el polígono de visibilidad exacto multiplicado por el degradado radial;
   * (3) se borra la niebla con ese pincel; (4) se borran las siluetas de los
   * personajes y muebles realmente visibles, para que nunca queden cortados por
   * una franja. Todo usa la misma transformación mundo→textura.
   */
  private updateFog(rx: number, ry: number) {
    const fog = this.fog, brush = this.brush, visImg = this.visImg;
    if (!fog || !brush || !visImg) return;
    const cam = this.cameras.main;
    const v = cam.worldView;
    const noFog = this.mode === 'lobby' || this.pos.ghost || this.sharedView();
    fog.setVisible(!noFog);
    if (noFog) return;
    if (Math.abs(this.targetFogRes() - this.fogRes) > 0.01) this.createFog();
    const R = this.fogRes;
    const margin = 48;
    // Alineado a la rejilla de píxeles de la textura para que los bordes no tiemblen.
    const fx0 = Math.floor((v.x - margin) * R) / R, fy0 = Math.floor((v.y - margin) * R) / R;
    fog.setPosition(fx0, fy0);
    const needW = Math.ceil((v.width + margin * 2) * R) + 4, needH = Math.ceil((v.height + margin * 2) * R) + 4;
    if (fog.width < needW || fog.height < needH) { fog.resize(needW + 32, needH + 32); brush.resize(needW + 32, needH + 32); }
    const ox = rx, oy = ry - 6;
    this.polyTimer++;
    this.poly = this.rt!.visibility(this.pos.level, ox, oy, this.pos.vis, this.doors, this.poly, store.prefs.quality === 'bajo' ? 120 : 180);
    const tx = (x: number) => (x - fx0) * R, ty = (y: number) => (y - fy0) * R;
    // Pincel = polígono × degradado
    const g = this.fogGfx;
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    for (let i = 0; i < this.poly.length; i += 2) {
      const px = tx(this.poly[i]), py = ty(this.poly[i + 1]);
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
    brush.clear();
    brush.draw(g, 0, 0);
    const diam = this.pos.vis * 2 * R;
    visImg.setDisplaySize(diam, diam);
    brush.erase(visImg, tx(ox), ty(oy));
    // Niebla
    const lights = store.pub?.sabotage?.id === 'lights';
    const imp = store.priv?.team === 'impostor';
    fog.clear();
    fog.fill(lights && !imp ? 0x12040a : 0x070912, lights && !imp ? 0.94 : 0.86);
    fog.erase(brush, 0, 0);
    // Siluetas visibles: personajes (incluido el propio) y muebles con línea de visión.
    const eraseObj = (obj: Phaser.GameObjects.Image | Phaser.GameObjects.Container | Phaser.GameObjects.Text, wx: number, wy: number, k: number) => {
      if (k <= 0.01) return;
      const px = obj.x, py = obj.y, sx = obj.scaleX, sy = obj.scaleY, al = obj.alpha;
      obj.setPosition(tx(wx), ty(wy)).setScale(sx * R, sy * R).setAlpha(al * k);
      fog.erase(obj);
      obj.setPosition(px, py).setScale(sx, sy).setAlpha(al);
    };
    if (this.me && this.me.root.visible) { eraseObj(this.me.root, this.me.root.x, this.me.root.y, 1); eraseObj(this.me.nameText, this.me.nameText.x, this.me.nameText.y, 1); }
    for (const e of this.ents.values()) {
      const c = e.char;
      if (!c.root.visible || c.alpha < 0.05 || e.level !== this.pos.level) continue;
      const k = this.sharedView() ? 1 : this.visAt(dist(ox, oy, c.root.x, c.root.y));
      eraseObj(c.root, c.root.x, c.root.y, k * Math.min(1, c.alpha));
      if (c.nameText.visible) eraseObj(c.nameText, c.nameText.x, c.nameText.y, k * Math.min(1, c.alpha));
    }
    for (const n of this.npcs) {
      const c = n.char;
      if (!c.root.visible || c.alpha < 0.05) continue;
      eraseObj(c.root, c.root.x, c.root.y, this.visAt(dist(ox, oy, c.root.x, c.root.y)) * Math.min(1, c.alpha));
    }
    if (this.polyTimer % 3 === 0) this.refreshPropVisibility(ox, oy, v);
    for (const pv of this.props) {
      if (!pv.img || !pv.visible || pv.def.level !== this.pos.level) continue;
      const r = pv.def.rect;
      if (r.x > v.right + 40 || r.x + r.w < v.x - 40 || r.y - pv.def.h > v.bottom + 40 || r.y + r.h < v.y - 40) continue;
      const cx = Math.max(r.x, Math.min(ox, r.x + r.w)), cy = Math.max(r.y, Math.min(oy, r.y + r.h));
      eraseObj(pv.img, pv.img.x, pv.img.y, this.visAt(dist(ox, oy, cx, cy)));
    }
  }

  /** Un mueble es visible si alguna parte de su contorno tiene línea de visión directa. */
  private refreshPropVisibility(ox: number, oy: number, v: Phaser.Geom.Rectangle) {
    const rt = this.rt!;
    const vis = this.pos.vis;
    for (const pv of this.props) {
      if (!pv.img) continue;
      const p = pv.def;
      const r = p.rect;
      if (p.level !== this.pos.level || r.x > v.right + 60 || r.x + r.w < v.x - 60 || r.y > v.bottom + 60 || r.y + r.h < v.y - 60) { pv.visible = false; continue; }
      const nx = Math.max(r.x, Math.min(ox, r.x + r.w)), ny = Math.max(r.y, Math.min(oy, r.y + r.h));
      if (dist(ox, oy, nx, ny) > vis) { pv.visible = false; continue; }
      const pts: [number, number][] = [
        [r.x + r.w / 2, r.y + r.h + 3], [r.x + 4, r.y + r.h + 3], [r.x + r.w - 4, r.y + r.h + 3],
        [r.x - 3, r.y + r.h / 2], [r.x + r.w + 3, r.y + r.h / 2], [r.x + r.w / 2, r.y - 3], [nx, ny],
      ];
      pv.visible = pts.some(([x, y]) => rt.los(p.level, ox, oy, x, y, this.doors));
    }
  }

  // ------------------------------------------------------------------ utilidades para la interfaz
  myPos() { return { x: this.pos.x, y: this.pos.y, level: this.pos.level }; }

  visibleEntities(range: number): { h: string; name: string; color: number; d: number }[] {
    const out: { h: string; name: string; color: number; d: number }[] = [];
    for (const e of this.ents.values()) {
      if (e.gone || e.last.k === 'r' || e.last.k === 'g' || e.last.cam || e.char.alpha < 0.5) continue;
      const d = dist(e.last.x, e.last.y, this.pos.x, this.pos.y);
      if (d <= range && e.level === this.pos.level) out.push({ h: e.h, name: e.last.n, color: e.last.c, d });
    }
    return out.sort((a, b) => a.d - b.d);
  }

  freeze(ms: number) { this.freezeUntil = performance.now() + ms; }

  shutdownScene() {
    this.scale.off('resize', this.resizeHandler);
    this.unloadMap();
  }
}

export { CHUNK };

function lerpColor(a: number, b: number, k: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
}
