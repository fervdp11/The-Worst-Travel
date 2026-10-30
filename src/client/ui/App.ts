import Phaser from 'phaser';
import type { AnyMapId, MapId } from '../../shared/maps/types';
import type { ChatMsg, EndResult, GameEvent, GameStart, PanelOpen, PrivateState, PublicGame, RoomState, Snapshot } from '../../shared/protocol';
import type { RoleId, Team } from '../../shared/roles';
import { generateCharacterTextures } from '../art/characters';
import { audio } from '../audio/Audio';
import { LocalTransport, Net, SocketTransport } from '../net/Net';
import { store } from '../state';
import { WorldScene } from '../world/WorldScene';
import { playCinematic } from './Cinematics';
import { clear, toast, uiRoot } from './dom';
import { showEnd } from './EndScreen';
import { HUD } from './HUD';
import { Loading } from './Loading';
import { LobbyUI } from './LobbyUI';
import { showMainMenu } from './MainMenu';
import { MeetingUI } from './Meeting';
import { PanelHost } from './Panels';
import { showRoleCard } from './RoleCard';
import { TouchControls } from './Touch';

export class App {
  game!: Phaser.Game;
  world!: WorldScene;
  net: Net | null = null;
  loading = new Loading();
  lobbyUI: LobbyUI | null = null;
  hud: HUD | null = null;
  meeting: MeetingUI | null = null;
  panels: PanelHost | null = null;
  touch: TouchControls | null = null;
  builtMap: AnyMapId | null = null;
  private building: Promise<void> | null = null;
  private unsub: (() => void)[] = [];
  private lastPhase = '';
  private endShown = false;
  private prevSabotage: string | null = null;

  async boot() {
    this.loading.show(0.02, 'Cargando tipografías…');
    await Promise.race([
      Promise.all([document.fonts.load('800 32px "Baloo 2"'), document.fonts.load('700 32px "Baloo 2"'), document.fonts.load('800 16px Nunito'), document.fonts.load('400 16px Nunito')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
    this.loading.show(0.15, 'Arrancando el motor gráfico…');
    await this.createGame();
    this.loading.show(0.4, 'Cosiendo uniformes…');
    await new Promise((r) => requestAnimationFrame(r));
    generateCharacterTextures(this.world);
    this.loading.show(0.8, 'Preparando la terminal…');
    this.applyPrefs();
    store.on('prefs', () => this.applyPrefs());
    this.installKeys();
    this.loading.show(1, 'Listo');
    setTimeout(() => this.loading.hide(), 150);
    showMainMenu(this);
  }

  private createGame(): Promise<void> {
    return new Promise((resolve) => {
      const parent = document.getElementById('game')!;
      const dpr = this.dpr();
      this.game = new Phaser.Game({
        type: Phaser.WEBGL,
        parent,
        width: Math.floor(window.innerWidth * dpr),
        height: Math.floor(window.innerHeight * dpr),
        backgroundColor: '#141a2e',
        scale: { mode: Phaser.Scale.NONE },
        render: { antialias: true, pixelArt: false, roundPixels: false, powerPreference: 'high-performance' },
        fps: { smoothStep: false },
        input: { mouse: false, touch: false, keyboard: true, gamepad: false },
        audio: { noAudio: true },
        banner: false,
        scene: [WorldScene],
      });
      this.game.registry.set('dpr', dpr);
      const fit = () => {
        const d = this.dpr();
        this.game.registry.set('dpr', d);
        this.game.scale.resize(Math.floor(window.innerWidth * d), Math.floor(window.innerHeight * d));
        const c = this.game.canvas;
        c.style.width = `${window.innerWidth}px`;
        c.style.height = `${window.innerHeight}px`;
      };
      window.addEventListener('resize', fit);
      this.game.events.once('world-ready', (w: WorldScene) => {
        this.world = w;
        fit();
        resolve();
      });
    });
  }

  /** Densidad de píxeles limitada según la calidad elegida. */
  dpr(): number {
    const cap = store.prefs.quality === 'alto' ? 2 : store.prefs.quality === 'medio' ? 1.5 : 1;
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  applyPrefs() {
    const p = store.prefs;
    document.documentElement.style.setProperty('--ui-scale', String(p.uiScale));
    document.body.classList.toggle('reduce-motion', p.reduceMotion);
    audio.setVolumes(p.master, p.music, p.sfx, p.ambience);
    window.dispatchEvent(new Event('resize'));
  }

  // ------------------------------------------------------------------ conexión
  private attach(net: Net) {
    this.detach();
    this.net = net;
    store.net = net;
    const u = this.unsub;
    u.push(net.on('room', (r) => this.onRoom(r)));
    u.push(net.on('gstart', (g) => this.onGstart(g)));
    u.push(net.on('pub', (p) => this.onPub(p)));
    u.push(net.on('priv', (p) => this.onPriv(p)));
    u.push(net.on('panel', (p) => this.onPanel(p)));
    u.push(net.on('ev', (e) => this.onEvent(e)));
    u.push(net.on('chat', (c) => this.onChat(c)));
    u.push(net.on('snap', (s) => this.onSnap(s)));
    u.push(net.on('err', (e) => { toast(e.msg, 'bad', 3500); if (e.code === 'version') this.loading.show(1, e.msg); }));
    net.statusListeners.add((s) => { store.emit('net'); if (s === 'disconnected' && store.view !== 'menu') toast('Conexión perdida. Reconectando…', 'warn'); });
  }

  private detach() {
    for (const f of this.unsub) f();
    this.unsub = [];
    this.net?.destroy();
    this.net = null;
    store.net = null;
  }

  connectOnline(): Net {
    if (this.net && !this.net.t.local) return this.net;
    const net = new Net(new SocketTransport(), () => store.prefs.name);
    this.attach(net);
    return net;
  }

  async connectPractice(): Promise<Net> {
    const t = new LocalTransport();
    const net = new Net(t, () => store.prefs.name);
    this.attach(net);
    await t.init();
    return net;
  }

  whenWelcome(net: Net): Promise<void> {
    if (net.pid) return Promise.resolve();
    return new Promise((res) => { const off = net.on('welcome', () => { off(); res(); }); });
  }

  async createRoom(mapId: MapId, maxPlayers: number, preset: string) {
    audio.unlock();
    const net = this.connectOnline();
    await this.whenWelcome(net);
    net.emit('create', { name: store.prefs.name, mapId, maxPlayers, preset });
  }

  async joinRoom(code: string) {
    audio.unlock();
    const net = this.connectOnline();
    await this.whenWelcome(net);
    net.emit('join', { code, name: store.prefs.name });
  }

  async startPractice(mapId: MapId, team: Team, role: RoleId | null) {
    audio.unlock();
    const net = await this.connectPractice();
    await this.whenWelcome(net);
    net.emit('practice', { name: store.prefs.name, mapId, team, role });
  }

  leaveRoom() {
    this.net?.emit('leave');
    this.teardownGameUI();
    this.lobbyUI?.destroy(); this.lobbyUI = null;
    store.room = null; store.pub = null; store.priv = null; store.gstart = null; store.chat = [];
    this.detach();
    this.world.unloadMap();
    this.builtMap = null;
    store.view = 'menu';
    audio.ambience(null);
    audio.music('menu');
    showMainMenu(this);
  }

  // ------------------------------------------------------------------ eventos del servidor
  private async onRoom(r: RoomState | null) {
    const prevMap = store.room?.mapId;
    store.room = r;
    store.emit('room');
    if (!r) {
      if (store.view !== 'menu') this.leaveRoom();
      return;
    }
    if (r.phase === 'ESPERA' && (store.view === 'menu' || (store.view === 'game' && !store.result))) await this.enterLobby();
    if (prevMap !== r.mapId || !r.players.find((p) => p.id === this.net?.pid)?.loaded) this.reportLoaded(r.mapId);
    if (this.world && store.view === 'lobby') this.world.refreshSelfLook();
  }

  /** Comprueba el plano del mapa seleccionado y notifica que los recursos están listos. */
  private reportLoaded(mapId: MapId) {
    setTimeout(() => { this.net?.emit('loaded', { mapId }); }, 50);
  }

  async enterLobby() {
    this.teardownGameUI();
    store.view = 'lobby';
    store.result = null;
    this.endShown = false;
    store.pub = null; store.priv = null; store.panel = null;
    clear(uiRoot());
    await this.buildMap('lobby', 'lobby');
    this.lobbyUI?.destroy();
    this.lobbyUI = new LobbyUI(this);
    this.ensureTouch();
    audio.ambience('lobby');
    audio.music('lobby');
  }

  private async buildMap(id: AnyMapId, mode: 'lobby' | 'game') {
    if (this.builtMap === id && this.world.mode === mode) return;
    if (this.building) await this.building;
    if (this.builtMap === id && this.world.mode === mode) return;
    this.building = (async () => {
      if (mode === 'game') this.loading.show(0, 'Cargando el vehículo…');
      await this.world.loadMap(id, mode, (p, lbl) => { if (mode === 'game') this.loading.show(p, lbl); });
      this.world.applyZoom();
      this.builtMap = id;
      if (mode === 'game') this.loading.hide();
    })();
    try { await this.building; } finally { this.building = null; }
  }

  private async onGstart(g: GameStart) {
    store.gstart = g;
    store.result = null;
    this.endShown = false;
    this.lobbyUI?.destroy(); this.lobbyUI = null;
    store.view = 'game';
    clear(uiRoot());
    await this.buildMap(g.mapId, 'game');
    this.net?.emit('loaded', { mapId: g.mapId });
    this.hud?.destroy();
    this.hud = new HUD(this);
    this.panels?.destroy();
    this.panels = new PanelHost(this);
    this.meeting?.destroy();
    this.meeting = new MeetingUI(this);
    this.ensureTouch();
    audio.ambience(g.mapId);
    audio.music(null);
    if (store.pub?.phase === 'INICIO' || !store.pub) showRoleCard(this);
    if (store.panel) this.panels.show(store.panel);
  }

  private onPub(p: PublicGame) {
    const prev = store.pub;
    store.pub = p;
    if (store.view === 'game') {
      if (p.phase !== this.lastPhase) {
        if (p.phase === 'DISCUSION' && this.lastPhase === 'EXPLORACION') { audio.sfx('meeting'); this.world.closeCamera(); }
        if (p.phase === 'EXPLORACION' && this.lastPhase === 'INICIO') audio.sfx('start');
        this.lastPhase = p.phase;
      }
      const sabId = p.sabotage?.id ?? null;
      if (sabId !== this.prevSabotage) {
        audio.alarm(p.sabotage ? (p.sabotage.kind === 'critical' ? 'critical' : p.sabotage.kind) : null);
        this.prevSabotage = sabId;
      }
      if (prev && prev.closedDoors.length !== p.closedDoors.length) audio.sfx('door');
    }
    store.emit('pub');
  }

  private onPriv(p: PrivateState) {
    store.priv = p;
    store.emit('priv');
    if (this.world) this.world.refreshSelfLook();
  }

  private onPanel(p: PanelOpen | null) {
    store.panel = p;
    store.emit('panel');
    this.panels?.show(p);
  }

  private onEvent(e: GameEvent) {
    switch (e.e) {
      case 'toast': toast(e.text, e.tone); break;
      case 'sound': audio.sfx(e.s); break;
      case 'end': this.onEnd(e.result); break;
      case 'meeting': break;
      case 'teleport': case 'fx': this.world.onEvent(e); if (e.e === 'fx') audio.sfx(`fx_${e.fx}`); break;
      default: break;
    }
    this.panels?.onEvent(e);
  }

  private async onEnd(r: EndResult) {
    if (this.endShown) return;
    this.endShown = true;
    store.result = r;
    store.view = 'end';
    this.panels?.show(null);
    audio.alarm(null);
    audio.ambience(null);
    await playCinematic(this, r);
    this.teardownGameUI();
    showEnd(this, r);
  }

  backToLobby() {
    this.net?.emit('back');
    store.result = null;
    if (store.room?.phase === 'ESPERA' || store.room?.phase === 'FINAL' || !store.room) void this.enterLobby();
    else void this.enterLobby();
  }

  private onChat(c: ChatMsg) {
    store.chat.push(c);
    if (store.chat.length > 120) store.chat.shift();
    store.emit('chat');
    if (c.from && c.from !== this.net?.pid) audio.sfx('chat');
  }

  private onSnap(s: Snapshot) {
    this.world?.onSnapshot(s);
  }

  private teardownGameUI() {
    this.hud?.destroy(); this.hud = null;
    this.meeting?.destroy(); this.meeting = null;
    this.panels?.destroy(); this.panels = null;
    this.world?.closeCamera();
  }

  private ensureTouch() {
    const want = store.prefs.touch === 'on' || (store.prefs.touch === 'auto' && matchMedia('(pointer: coarse)').matches);
    if (want && !this.touch) this.touch = new TouchControls(this);
    if (!want && this.touch) { this.touch.destroy(); this.touch = null; }
    this.touch?.attach();
  }

  // ------------------------------------------------------------------ teclado
  typing(): boolean {
    const a = document.activeElement as HTMLElement | null;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  }

  private installKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (this.panels?.closeTop()) e.preventDefault(); return; }
      if (this.typing()) return;
      const k = e.key.toLowerCase();
      if (k === 'f3') { e.preventDefault(); this.world?.toggleDebug(); return; }
      if (k === 'tab') e.preventDefault();
      if (store.panel?.kind === 'minigame') return;
      this.hud?.onKey(k, e);
      this.lobbyUI?.onKey(k);
    });
    // Bloquear movimiento mientras se escribe en el chat o hay paneles.
    setInterval(() => {
      if (!this.world) return;
      this.world.inputBlocked = this.typing() || (!!store.panel && store.panel.kind !== 'observer') || !!document.querySelector('.modal-back');
    }, 50);
  }
}
