/**
 * Audio sintetizado en tiempo real (WebAudio): todos los sonidos son originales,
 * generados con osciladores y ruido filtrado. Se activa tras una interacción.
 */
type AmbKind = 'train' | 'ship' | 'plane' | 'lobby' | null;

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private noise!: AudioBuffer;
  private ambNodes: { stop: () => void } | null = null;
  private ambKind: AmbKind = null;
  private alarmNodes: { stop: () => void } | null = null;
  private musicNodes: { stop: () => void } | null = null;
  private musicKind: string | null = null;
  private vols = { master: 0.8, music: 0.5, sfx: 0.8, amb: 0.6 };
  private pendingAmb: AmbKind = null;
  private pendingMusic: string | null = null;
  private lastSfx = new Map<string, number>();

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.connect(this.master);
    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    if (this.pendingAmb) this.ambience(this.pendingAmb);
    if (this.pendingMusic) this.music(this.pendingMusic);
  }

  setVolumes(master: number, music: number, sfx: number, amb: number) {
    this.vols = { master, music, sfx, amb };
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vols.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vols.music * 0.35, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vols.sfx * 0.6, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vols.amb * 0.5, t, 0.05);
  }

  private noiseSrc(loop = true) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, when = 0, slide = 0, bus = this.sfxBus) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private burst(dur: number, freq: number, q = 1, vol = 0.3, when = 0, type: BiquadFilterType = 'bandpass') {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const s = this.noiseSrc(false);
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  sfx(name: string) {
    if (!this.ctx) return;
    const now = performance.now();
    if ((this.lastSfx.get(name) ?? 0) > now - 60) return;
    this.lastSfx.set(name, now);
    switch (name) {
      case 'click': this.tone(660, 0.06, 'triangle', 0.18); break;
      case 'hover': this.tone(880, 0.03, 'sine', 0.05); break;
      case 'open': this.tone(420, 0.08, 'triangle', 0.18, 0, 200); break;
      case 'close': this.tone(520, 0.08, 'triangle', 0.15, 0, -200); break;
      case 'ok': this.tone(660, 0.1, 'triangle', 0.22); this.tone(990, 0.16, 'triangle', 0.2, 0.08); break;
      case 'bad': this.tone(220, 0.16, 'square', 0.12); this.tone(180, 0.2, 'square', 0.1, 0.1); break;
      case 'task': this.tone(523, 0.1, 'triangle', 0.2); this.tone(659, 0.1, 'triangle', 0.2, 0.08); this.tone(784, 0.22, 'triangle', 0.22, 0.16); break;
      case 'step': this.burst(0.04, 1800, 1.5, 0.12); break;
      case 'chat': this.tone(1200, 0.05, 'sine', 0.08); break;
      case 'meeting': for (let i = 0; i < 3; i++) { this.tone(392, 0.25, 'sawtooth', 0.12, i * 0.3); this.tone(523, 0.25, 'sawtooth', 0.1, i * 0.3 + 0.12); } break;
      case 'vote': this.tone(740, 0.08, 'triangle', 0.2); break;
      case 'eject': this.burst(0.8, 400, 0.6, 0.35, 0, 'lowpass'); this.tone(300, 0.6, 'sine', 0.2, 0, -220); break;
      case 'start': this.tone(392, 0.15, 'triangle', 0.2); this.tone(523, 0.15, 'triangle', 0.2, 0.12); this.tone(659, 0.3, 'triangle', 0.22, 0.24); break;
      case 'door': this.burst(0.25, 300, 0.8, 0.3, 0, 'lowpass'); this.tone(90, 0.2, 'square', 0.08); break;
      case 'fixed': this.tone(587, 0.12, 'triangle', 0.2); this.tone(880, 0.25, 'triangle', 0.22, 0.1); break;
      case 'alarm': this.tone(880, 0.2, 'square', 0.1); this.tone(660, 0.2, 'square', 0.1, 0.22); break;
      case 'alarmCritical': this.tone(990, 0.25, 'sawtooth', 0.12); this.tone(740, 0.25, 'sawtooth', 0.12, 0.27); break;
      case 'fx_vent': this.burst(0.3, 700, 0.7, 0.3); this.tone(140, 0.15, 'square', 0.08); break;
      case 'fx_locker': this.burst(0.15, 900, 1, 0.25); this.tone(220, 0.08, 'square', 0.08); break;
      case 'fx_poof': case 'fx_fade': case 'fx_unfade': case 'fx_decoy': this.burst(0.35, 2400, 0.5, 0.18); this.tone(600, 0.3, 'sine', 0.1, 0, 500); break;
      case 'fx_sensor': this.tone(1400, 0.08, 'sine', 0.12); this.tone(1800, 0.08, 'sine', 0.1, 0.1); break;
      case 'fx_sparkle': this.tone(1568, 0.12, 'sine', 0.08); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.2, i * 0.14)); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.18, i * 0.2)); break;
      case 'crash': this.burst(1.6, 200, 0.4, 0.5, 0, 'lowpass'); this.tone(120, 1.2, 'sawtooth', 0.15, 0, -80); break;
      default: break;
    }
  }

  /** Alarmas distinguibles por tipo de sabotaje (no imprescindibles para entender la emergencia). */
  alarm(kind: string | null) {
    if (!this.ctx) return;
    this.alarmNodes?.stop();
    this.alarmNodes = null;
    if (!kind || kind === 'doors') { if (kind === 'doors') this.sfx('door'); return; }
    const c = this.ctx;
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lg = c.createGain();
    const g = c.createGain();
    if (kind === 'critical') { o.type = 'sawtooth'; o.frequency.value = 780; lfo.frequency.value = 1.6; lg.gain.value = 220; g.gain.value = 0.06; }
    else if (kind === 'lights') { o.type = 'sine'; o.frequency.value = 110; lfo.frequency.value = 0.5; lg.gain.value = 10; g.gain.value = 0.08; }
    else { o.type = 'square'; o.frequency.value = 1300; lfo.frequency.value = 3; lg.gain.value = 300; g.gain.value = 0.02; }
    lfo.connect(lg); lg.connect(o.frequency);
    o.connect(g); g.connect(this.sfxBus);
    o.start(); lfo.start();
    this.alarmNodes = { stop: () => { try { g.gain.setTargetAtTime(0, c.currentTime, 0.1); o.stop(c.currentTime + 0.5); lfo.stop(c.currentTime + 0.5); } catch { /* ya parado */ } } };
  }

  /** Ambiente propio de cada vehículo: raíles y viento, agua y motor grave, turbinas y ventilación. */
  ambience(kind: AmbKind) {
    if (!this.ctx) { this.pendingAmb = kind; return; }
    if (kind === this.ambKind && this.ambNodes) return;
    this.ambNodes?.stop();
    this.ambNodes = null;
    this.ambKind = kind;
    if (!kind) return;
    const c = this.ctx;
    const stops: (() => void)[] = [];
    const out = c.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, c.currentTime, 0.8);
    out.connect(this.ambBus);
    const noiseLayer = (freq: number, type: BiquadFilterType, vol: number, q = 0.7) => {
      const s = this.noiseSrc(); const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(out); s.start();
      stops.push(() => s.stop()); return { f, g };
    };
    const drone = (freq: number, type: OscillatorType, vol: number) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = freq; const g = c.createGain(); g.gain.value = vol;
      o.connect(g); g.connect(out); o.start(); stops.push(() => o.stop()); return { o, g };
    };
    let timer: ReturnType<typeof setInterval> | null = null;
    if (kind === 'train') {
      noiseLayer(420, 'lowpass', 0.25);
      noiseLayer(2200, 'bandpass', 0.05, 0.4);
      drone(55, 'triangle', 0.05);
      let k = 0;
      timer = setInterval(() => { // traqueteo de los raíles
        const t = c.currentTime;
        const hit = (when: number, v: number) => {
          const s = this.noiseSrc(false); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 160; f.Q.value = 2;
          const g = c.createGain(); g.gain.setValueAtTime(v, t + when); g.gain.exponentialRampToValueAtTime(0.0001, t + when + 0.12);
          s.connect(f); f.connect(g); g.connect(out); s.start(t + when, Math.random()); s.stop(t + when + 0.2);
        };
        hit(0, 0.5); hit(0.11, 0.35);
        k++;
      }, 820);
    } else if (kind === 'ship') {
      const w = noiseLayer(500, 'lowpass', 0.3);
      drone(42, 'sawtooth', 0.025);
      drone(84, 'sine', 0.03);
      const lfo = c.createOscillator(); lfo.frequency.value = 0.12; const lg = c.createGain(); lg.gain.value = 0.18;
      lfo.connect(lg); lg.connect(w.g.gain); lfo.start(); stops.push(() => lfo.stop());
      timer = setInterval(() => { if (Math.random() < 0.35) this.tone(70 + Math.random() * 40, 0.5, 'triangle', 0.05, 0, 20, out as unknown as GainNode); }, 2600);
    } else if (kind === 'plane') {
      noiseLayer(900, 'lowpass', 0.22);
      noiseLayer(3000, 'bandpass', 0.03, 0.5);
      drone(110, 'sawtooth', 0.012);
      drone(220.5, 'sine', 0.012);
      timer = setInterval(() => { if (Math.random() < 0.15) { this.tone(880, 0.25, 'sine', 0.04, 0, 0, out as unknown as GainNode); this.tone(660, 0.35, 'sine', 0.04, 0.28, 0, out as unknown as GainNode); } }, 9000);
    } else {
      noiseLayer(700, 'lowpass', 0.08);
      timer = setInterval(() => { if (Math.random() < 0.25) { [659, 784, 523].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.03, i * 0.3, 0, out as unknown as GainNode)); } }, 7000);
    }
    this.ambNodes = { stop: () => { if (timer) clearInterval(timer); out.gain.setTargetAtTime(0, c.currentTime, 0.3); setTimeout(() => { for (const s of stops) try { s(); } catch { /* */ } }, 1200); } };
  }

  /** Música contenida: arpegio suave en menú y sala de espera. */
  music(kind: string | null) {
    if (!this.ctx) { this.pendingMusic = kind; return; }
    if (kind === this.musicKind) return;
    this.musicNodes?.stop();
    this.musicNodes = null;
    this.musicKind = kind;
    if (!kind) return;
    const notes = kind === 'menu' ? [262, 330, 392, 494, 440, 392, 330, 294] : [294, 370, 440, 554, 494, 440, 370, 330];
    let i = 0;
    const timer = setInterval(() => {
      const f = notes[i % notes.length];
      this.tone(f, 0.5, 'triangle', 0.08, 0, 0, this.musicBus);
      if (i % 4 === 0) this.tone(f / 2, 1.2, 'sine', 0.07, 0, 0, this.musicBus);
      i++;
    }, 420);
    this.musicNodes = { stop: () => clearInterval(timer) };
  }
}

export const audio = new AudioEngine();
