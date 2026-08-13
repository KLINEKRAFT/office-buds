/**
 * Tiny synthesised sound bank. Everything is generated with WebAudio oscillators and
 * noise bursts, so there are no audio files to download and nothing to wait for.
 *
 * The brief was "do not let sound become obnoxious", so levels are deliberately low,
 * footsteps are randomised so they never sound like a machine gun, and the office
 * ambience is a single quiet filtered hum rather than a loop that starts to grate.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: { osc: OscillatorNode; noise: AudioBufferSourceNode } | null = null;
  private muted = false;
  private lastStep = 0;

  /** Must be called from a user gesture; browsers block audio otherwise. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.startAmbience();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Low HVAC rumble plus a whisper of fluorescent hiss. */
  private startAmbience(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.ambience) return;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 58;
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.035;
    osc.connect(oscGain).connect(master);
    osc.start();

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(2);
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1400;
    band.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.006;
    noise.connect(band).connect(noiseGain).connect(master);
    noise.start();

    this.ambience = { osc, noise };
  }

  private blip(freq: number, at: number, dur: number, type: OscillatorType, gain: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /** Soft carpet footfall. Rate limited by the caller passing the walk cycle phase. */
  step(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    if (now - this.lastStep < 0.16) return;
    this.lastStep = now;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.06);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 620 + Math.random() * 260;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    src.connect(filter).connect(g).connect(master);
    src.start(now);
  }

  /** Your own message going out. */
  sendMessage(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.blip(660, ctx.currentTime, 0.07, "square", 0.05);
    this.blip(990, ctx.currentTime + 0.06, 0.09, "square", 0.045);
  }

  /** A message arriving from your friend - lower, so the two are distinguishable. */
  receiveMessage(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.blip(520, ctx.currentTime, 0.07, "square", 0.05);
    this.blip(392, ctx.currentTime + 0.06, 0.1, "square", 0.045);
  }

  /** Someone walked in. */
  join(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    [523, 659, 784].forEach((f, i) => this.blip(f, t + i * 0.07, 0.1, "square", 0.04));
  }

  leave(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    [784, 523].forEach((f, i) => this.blip(f, t + i * 0.08, 0.12, "square", 0.035));
  }

  /** Keystroke tick while typing a message. */
  type(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.blip(1200 + Math.random() * 300, ctx.currentTime, 0.02, "square", 0.018);
  }

  dispose(): void {
    this.ambience?.osc.stop();
    this.ambience?.noise.stop();
    this.ambience = null;
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}
