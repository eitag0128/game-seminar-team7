/** PROTOTYPE: 音素材なしで Web Audio から作る仮の雨音と効果音。正式な BGM/SE ではない。 */
export type SoundCue = 'open' | 'chime' | 'loop';

export class Sound {
  private context?: AudioContext;
  private output?: GainNode;
  private muffle?: BiquadFilterNode;
  private dropTimer = 0;
  lastCue = '';

  constructor(public enabled: boolean) {}

  get started(): boolean { return this.context !== undefined; }

  /** ブラウザの自動再生制限があるため、クリックやキー入力の処理中に呼ぶ。 */
  start(): void {
    if (this.context) { void this.context.resume(); return; }
    if (!window.AudioContext) return;
    const context = new AudioContext();
    this.context = context;
    this.output = context.createGain();
    this.output.gain.value = this.enabled ? 1 : 0;
    this.output.connect(context.destination);
    this.muffle = context.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 12000;
    this.muffle.connect(this.output);
    const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    // 高い帯域で雨粒のざわめき、低い帯域で遠くの雨の厚みを作る。
    const layers = [['highpass', 900, 0.07, 0], ['lowpass', 420, 0.12, 1]] as const;
    for (const [type, frequency, level, offset] of layers) {
      const source = context.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(level, context.currentTime + 2.5);
      source.connect(filter).connect(gain).connect(this.muffle);
      source.start(0, offset);
    }
    this.dropTimer = window.setInterval(() => this.drop(), 140);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.context && this.output) this.output.gain.setTargetAtTime(enabled ? 1 : 0, this.context.currentTime, 0.05);
  }

  /** パズル拡大中は雨を少し遠くする。 */
  setMuffled(muffled: boolean): void {
    if (this.context && this.muffle) this.muffle.frequency.setTargetAtTime(muffled ? 700 : 12000, this.context.currentTime, 0.25);
  }

  play(cue: SoundCue): void {
    this.lastCue = cue;
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    if (cue === 'open') {
      this.tone(170, now, 0.3, 0.08, 'sine', 0.01, 110);
      this.tone(1800, now, 0.05, 0.015, 'triangle');
    } else if (cue === 'chime') {
      [659.25, 830.61, 987.77, 1318.51].forEach((frequency, index) => {
        this.tone(frequency, now + index * 0.11, 2.2, 0.07, 'triangle');
        this.tone(frequency / 2, now + index * 0.11, 2.2, 0.03, 'sine');
      });
    } else {
      // わずかにずらした低音のうなりで、同じ場所へ戻った違和感を出す。
      this.tone(196, now, 1.8, 0.05, 'sine', 0.5);
      this.tone(199, now, 1.8, 0.04, 'sine', 0.5);
    }
  }

  private drop(): void {
    if (!this.context || Math.random() > 0.35) return;
    const frequency = 1400 + Math.random() * 2200;
    this.tone(frequency, this.context.currentTime, 0.06, 0.012, 'sine', 0.003, frequency * 0.6, this.muffle);
  }

  private tone(frequency: number, at: number, duration: number, level: number, type: OscillatorType,
    attack = 0.01, glideTo?: number, destination?: AudioNode): void {
    const context = this.context!;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (glideTo) oscillator.frequency.exponentialRampToValueAtTime(glideTo, at + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(destination ?? this.output!);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.05);
  }

  dispose(): void {
    window.clearInterval(this.dropTimer);
    void this.context?.close();
  }
}
