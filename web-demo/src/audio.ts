/** PROTOTYPE: 音素材なしで Web Audio から作る仮の雨音と効果音。正式な BGM/SE ではない。 */
export type SoundCue = 'open' | 'chime' | 'loop';

export class Sound {
  private context?: AudioContext;
  private output?: GainNode;
  private ambience?: GainNode;
  private noise?: AudioBuffer;
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
    // 雨音と雨粒はこの音量つまみを通す。パズル中は音色を変えず音量だけ下げる。
    this.ambience = context.createGain();
    this.ambience.connect(this.output);
    const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    this.noise = noise;
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
      source.connect(filter).connect(gain).connect(this.ambience);
      source.start(0, offset);
    }
    this.dropTimer = window.setInterval(() => this.drop(), 140);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.context && this.output) this.output.gain.setTargetAtTime(enabled ? 1 : 0, this.context.currentTime, 0.05);
  }

  /** パズル拡大中は雨音を少し小さくする。 */
  setDimmed(dimmed: boolean): void {
    if (this.context && this.ambience) this.ambience.gain.setTargetAtTime(dimmed ? 0.45 : 1, this.context.currentTime, 0.15);
  }

  play(cue: SoundCue): void {
    this.lastCue = cue;
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    if (cue === 'open') {
      this.click(now);
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
    this.tone(frequency, this.context.currentTime, 0.06, 0.012, 'sine', 0.003, frequency * 0.6, this.ambience);
  }

  /** 自販機のボタンのような短い「カチッ」。音程は動かさない。 */
  private click(at: number): void {
    const context = this.context!;
    const source = context.createBufferSource();
    source.buffer = this.noise!;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2600;
    filter.Q.value = 1.2;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
    source.connect(filter).connect(gain).connect(this.output!);
    source.start(at, 0.5, 0.05);
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
