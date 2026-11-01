/**
 * 効果音。コンポーザー提供の音（materials/se、2026-11-01）を使う。?inline でJSに埋め込み、ダブルクリック版でも鳴る。
 * 感電の音だけは素材がないので、Web Audio で作った仮の音。
 */
import rainUrl from './assets/se/rain.wav?inline';
import correctUrl from './assets/se/correct.wav?inline';
import wrongUrl from './assets/se/wrong.wav?inline';
import selectUrl from './assets/se/select.wav?inline';
import stepUrl from './assets/se/step.wav?inline';
import warpUrl from './assets/se/warp.wav?inline';
import vendingUrl from './assets/se/vending.mp3?inline';

export type SoundCue = 'select' | 'step' | 'correct' | 'wrong' | 'vending' | 'warp' | 'shock';

const FILES = { select: selectUrl, step: stepUrl, correct: correctUrl, wrong: wrongUrl, vending: vendingUrl, warp: warpUrl } as const;
// 素材ごとの音量。足音は歩くたびに鳴るので小さめ。
const LEVELS: Record<SoundCue, number> = { select: 0.6, step: 0.35, correct: 0.8, wrong: 0.7, vending: 0.8, warp: 0.8, shock: 0.12 };

function decodeDataUrl(url: string): ArrayBuffer {
  const binary = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export class Sound {
  private context?: AudioContext;
  private output?: GainNode;
  private ambience?: GainNode;
  private buffers = new Map<string, AudioBuffer>();
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
    // 雨音はこの音量つまみを通す。拡大画面の間は音色を変えず音量だけ下げる。
    this.ambience = context.createGain();
    this.ambience.connect(this.output);
    for (const [name, url] of Object.entries({ ...FILES, rain: rainUrl })) {
      context.decodeAudioData(decodeDataUrl(url)).then((buffer) => {
        this.buffers.set(name, buffer);
        if (name === 'rain') this.startRain(buffer);
      }).catch((error: unknown) => console.warn(`効果音 ${name} を読めませんでした`, error));
    }
  }

  private startRain(buffer: AudioBuffer): void {
    const context = this.context!;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.55, context.currentTime + 2);
    source.connect(gain).connect(this.ambience!);
    source.start();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.context && this.output) this.output.gain.setTargetAtTime(enabled ? 1 : 0, this.context.currentTime, 0.05);
  }

  /** 拡大画面（自販機・マンホール）の間は雨音を少し小さくする。 */
  setDimmed(dimmed: boolean): void {
    if (this.context && this.ambience) this.ambience.gain.setTargetAtTime(dimmed ? 0.45 : 1, this.context.currentTime, 0.15);
  }

  play(cue: SoundCue): void {
    // 足音は歩くたびに鳴るので、「最後に鳴った音」の記録には残さない。
    if (cue !== 'step') this.lastCue = cue;
    const context = this.context;
    if (!context || !this.output) return;
    if (cue === 'shock') { this.buzz(context.currentTime); return; }
    const buffer = this.buffers.get(cue);
    if (!buffer) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = LEVELS[cue];
    source.connect(gain).connect(this.output);
    source.start();
  }

  /** 感電の「ビリビリ」。のこぎり波を細かく震わせる。 */
  private buzz(at: number): void {
    const context = this.context!;
    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(110, at);
    const wobble = context.createOscillator();
    wobble.frequency.value = 38;
    const depth = context.createGain();
    depth.gain.value = 60;
    wobble.connect(depth).connect(oscillator.frequency);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(LEVELS.shock, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
    oscillator.connect(gain).connect(this.output!);
    for (const node of [oscillator, wobble]) { node.start(at); node.stop(at + 1.2); }
  }

  dispose(): void {
    void this.context?.close();
  }
}
