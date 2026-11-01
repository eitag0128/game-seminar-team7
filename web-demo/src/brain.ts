import { DEMO, DRINKS } from './config.ts';
import type { Step } from './progression.ts';
import { FISH_LINES, NARRATION } from './story.ts';

/**
 * 頭の中（右の画面）。PROTOTYPE: 絵はデザイナーのコラージュが届くまでの仮。
 * 動きと当たり判定はこのファイルに閉じているので、絵を差し替えても進行（progression.ts）は変わらない。
 */
export interface BrainHandlers {
  canClick(): void;
  wireDrop(inWater: boolean): void;
  narrationDone(step: Step): void;
}

const ORDER: Step[] = ['intro', 'machine', 'choose', 'pour', 'drained', 'manhole', 'flooded', 'pole', 'wire', 'shocked', 'exit'];
const POUR_CANS = [
  { left: 20, top: 12, color: DRINKS[0].color },
  { left: 34, top: 20, color: DRINKS[3].color },
  { left: 50, top: 9, color: DRINKS[4].color },
  { left: 65, top: 19, color: '#8fcf7a' },
  { left: 79, top: 13, color: '#b58ad8' },
];
// 粒は 上 → 右 → 下 → 左 の順に飛ぶ（プランナー:「4方向に散らばるように、1クリック1粒」）。
const GRAIN_DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
// 電線は倒れた電柱の上から出ている。位置は頭の中の画面に対する %。
const WIRE_START = { x: 47, y: 24 };
const WIRE_REST = { x: 82, y: 30 };

function collage(): string {
  const patches = [
    ['#2b3a8f', 0, 0, 160, 120, -4], ['#c2457a', 150, -10, 140, 110, 6], ['#3a6fb8', 270, 0, 150, 120, -3],
    ['#f0b84a', 20, 100, 90, 70, 8], ['#6d3fa0', 300, 110, 110, 90, -7], ['#d86fa6', 120, 95, 80, 60, -10],
    ['#2f8c8c', 340, 20, 70, 60, 12], ['#e2c46a', 230, 120, 70, 50, 5], ['#4a2f7a', -20, 170, 120, 140, 4],
    ['#c45c5c', 310, 190, 110, 120, -5], ['#355fa0', 90, 200, 240, 110, 0],
  ];
  const rects = patches.map(([fill, x, y, w, h, r]) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" transform="rotate(${r} ${Number(x) + Number(w) / 2} ${Number(y) + Number(h) / 2})" opacity="0.85"/>`).join('');
  const stars = [[40, 30], [120, 18], [260, 40], [360, 70], [200, 70], [90, 80]]
    .map(([x, y]) => `<path d="M${x} ${y - 6}L${x + 2} ${y - 2}L${x + 6} ${y}L${x + 2} ${y + 2}L${x} ${y + 6}L${x - 2} ${y + 2}L${x - 6} ${y}L${x - 2} ${y - 2}Z" fill="#f6e7a1"/>`).join('');
  return `<svg class="collage" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="400" height="300" fill="#151c4a"/>${rects}${stars}
    <circle cx="170" cy="42" r="16" fill="#f6e7a1"/><circle cx="178" cy="37" r="14" fill="#2b3a8f"/>
    <circle cx="250" cy="40" r="22" fill="#ece3cf" stroke="#3b2f2a" stroke-width="3"/>
    <path d="M250 40V26M250 40L260 46" stroke="#3b2f2a" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M30 250q40-30 80 0q-40 22-80 0z" fill="#f2efe6" stroke="#20243f" stroke-width="3"/><circle cx="70" cy="250" r="9" fill="#20243f"/>
    <path d="M300 200l30 0l-6 10l-18 0z" fill="#f2efe6"/><path d="M315 200l0-18l12 18z" fill="#f2efe6"/>
  </svg>`;
}

export class Brain {
  private root: HTMLElement;
  private subtitle: HTMLButtonElement;
  private grains: HTMLElement;
  private wireLine: SVGLineElement;
  private wireEnd: HTMLButtonElement;
  private pool: HTMLElement;
  private fishes: HTMLElement[];
  private step: Step = 'intro';
  private narrating: { step: Step; lines: readonly string[]; index: number } | null = null;
  private narrationTimer = 0;
  private fishTimer = 0;
  private grainCount = 0;
  private dragging = false;

  constructor(host: HTMLElement, private handlers: BrainHandlers) {
    host.innerHTML = `
      <div class="brain-scene" data-step="intro">
        ${collage()}
        <div class="pool"><div class="water"></div><div class="grate" aria-hidden="true"></div></div>
        <div class="pour-cans" aria-hidden="true">${POUR_CANS.map((can) => `<span class="pour-can" style="left:${can.left}%;top:${can.top}%;--c:${can.color}"><span class="can-body"></span><span class="stream" style="height:${60 - can.top}cqh"></span></span>`).join('')}</div>
        <div class="fishes" aria-hidden="true">${[24, 50, 74].map((left, index) => `<span class="fish" style="left:${left}%;--delay:${index * 0.7}s"><span class="bubble"></span></span>`).join('')}</div>
        <div class="grains" aria-hidden="true"></div>
        <button class="brain-can" type="button" aria-label="頭の中の缶"><span class="mark">?</span></button>
        <div class="pole-fall" aria-hidden="true"></div>
        <svg class="wire" aria-hidden="true"><line x1="${WIRE_START.x}%" y1="${WIRE_START.y}%" x2="${WIRE_REST.x}%" y2="${WIRE_REST.y}%"/></svg>
        <button class="wire-end" type="button" aria-label="電線の先" style="left:${WIRE_REST.x}%;top:${WIRE_REST.y}%"></button>
        <div class="shock-flash" aria-hidden="true"></div>
        <span class="art-note">頭の中（仮の絵）</span>
        <button class="subtitle" type="button" aria-live="polite"></button>
      </div>`;
    this.root = host.querySelector('.brain-scene')!;
    this.subtitle = host.querySelector('.subtitle')!;
    this.grains = host.querySelector('.grains')!;
    this.wireLine = host.querySelector('.wire line')!;
    this.wireEnd = host.querySelector('.wire-end')!;
    this.pool = host.querySelector('.pool')!;
    this.fishes = [...host.querySelectorAll<HTMLElement>('.fish')];
    host.querySelector('.brain-can')!.addEventListener('click', () => handlers.canClick());
    // 文をクリック/タップすると、待たずに次の行へ進む。
    this.subtitle.addEventListener('click', () => this.nextLine());
    this.bindWire();
    this.render();
  }

  /** 進行が変わった時に呼ぶ。新しく入った段階に文があれば読み始める。 */
  setStep(step: Step): void {
    if (step === this.step) return;
    // 「もう一度遊ぶ」で前の段階に戻った時は、粒・感電・電線を消してから描き直す。
    if (ORDER.indexOf(step) < ORDER.indexOf(this.step)) {
      this.grains.innerHTML = '';
      this.grainCount = 0;
      delete this.root.dataset.grains;
      this.root.classList.remove('shocking');
    }
    this.step = step;
    this.render();
    if (step === 'shocked') this.root.classList.add('shocking');
    if (step === 'wire' || step === 'intro') this.resetWire();
    if (step in NARRATION) this.say(step, NARRATION[step as keyof typeof NARRATION]);
  }

  /** 最初の文を読み始める（起動時に一度だけ）。 */
  start(): void {
    this.say('intro', NARRATION.intro);
  }

  /** 頭の中の缶から黄色い粒を1つ飛ばす（4方向に順番に散らばり、そのまま残る）。 */
  spawnGrain(): void {
    const [dx, dy] = GRAIN_DIRECTIONS[this.grainCount % GRAIN_DIRECTIONS.length];
    const ring = Math.floor(this.grainCount / GRAIN_DIRECTIONS.length);
    const distance = 13 + ring * 4;
    const grain = document.createElement('span');
    grain.className = 'grain';
    grain.style.setProperty('--dx', `${dx * distance * 1.6 + (ring % 2) * 3}cqmin`);
    grain.style.setProperty('--dy', `${dy * distance + (ring % 2) * 3}cqmin`);
    this.grains.append(grain);
    this.grainCount++;
    this.root.dataset.grains = String(this.grainCount);
  }

  get narrationLine(): string { return this.subtitle.textContent ?? ''; }

  private reached(step: Step): boolean { return ORDER.indexOf(this.step) >= ORDER.indexOf(step); }

  private render(): void {
    const step = this.step;
    this.root.dataset.step = step;
    const flags: Record<string, boolean> = {
      'show-can': step === 'choose' || step === 'pour',
      'can-mixed': step === 'pour',
      poured: this.reached('drained'),
      drained: step === 'drained' || step === 'manhole',
      flooded: this.reached('flooded'),
      'pole-down': this.reached('wire'),
      'wire-live': step === 'wire',
      dead: this.reached('shocked'),
    };
    for (const [name, on] of Object.entries(flags)) this.root.classList.toggle(name, on);
    this.wireEnd.disabled = step !== 'wire';
    this.wireEnd.tabIndex = step === 'wire' ? 0 : -1;
    window.clearInterval(this.fishTimer);
    if (flags.flooded && !flags.dead) this.fishTimer = window.setInterval(() => this.fishTalk(), 2400);
    else this.fishes.forEach((fish) => fish.classList.remove('talking'));
  }

  private say(step: Step, lines: readonly string[]): void {
    window.clearTimeout(this.narrationTimer);
    this.narrating = { step, lines, index: -1 };
    this.nextLine();
  }

  private nextLine(): void {
    const narration = this.narrating;
    if (!narration) return;
    window.clearTimeout(this.narrationTimer);
    narration.index++;
    if (narration.index >= narration.lines.length) {
      this.narrating = null;
      this.root.classList.remove('narrating');
      this.handlers.narrationDone(narration.step);
      return;
    }
    this.subtitle.textContent = narration.lines[narration.index];
    this.root.classList.add('narrating');
    this.subtitle.classList.remove('line-in');
    void this.subtitle.offsetWidth; // 行が変わるたびにフェードし直す
    this.subtitle.classList.add('line-in');
    this.narrationTimer = window.setTimeout(() => this.nextLine(), DEMO.narrationSeconds * 1000);
  }

  private fishTalkIndex = 0;
  private fishTalk(): void {
    const fish = this.fishes[this.fishTalkIndex % this.fishes.length];
    this.fishes.forEach((other) => other.classList.remove('talking'));
    fish.querySelector('.bubble')!.textContent = FISH_LINES[this.fishTalkIndex % FISH_LINES.length];
    fish.classList.add('talking');
    this.fishTalkIndex++;
  }

  private resetWire(): void { this.placeWireEnd(WIRE_REST.x, WIRE_REST.y); }

  private placeWireEnd(x: number, y: number): void {
    this.wireEnd.style.left = `${x}%`;
    this.wireEnd.style.top = `${y}%`;
    this.wireLine.setAttribute('x2', `${x}%`);
    this.wireLine.setAttribute('y2', `${y}%`);
  }

  /** 電線の先をドラッグして、離した所が水の中なら感電。キーボードでは Enter/Space で水に入れる。 */
  private bindWire(): void {
    const toPercent = (event: PointerEvent) => {
      const box = this.root.getBoundingClientRect();
      return {
        x: Math.min(100, Math.max(0, (event.clientX - box.left) / box.width * 100)),
        y: Math.min(100, Math.max(0, (event.clientY - box.top) / box.height * 100)),
      };
    };
    this.wireEnd.addEventListener('pointerdown', (event) => {
      if (this.step !== 'wire') return;
      event.preventDefault();
      this.dragging = true;
      try { this.wireEnd.setPointerCapture(event.pointerId); } catch { /* 捕まえられなくても move/up は届く */ }
      this.root.classList.add('dragging');
    });
    this.wireEnd.addEventListener('pointermove', (event) => {
      if (!this.dragging) return;
      const point = toPercent(event);
      this.placeWireEnd(point.x, point.y);
    });
    const finish = (event: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.root.classList.remove('dragging');
      const pool = this.pool.getBoundingClientRect();
      // 水面は楕円なので、楕円の中かどうかで判定する。
      const nx = (event.clientX - (pool.left + pool.width / 2)) / (pool.width / 2);
      const ny = (event.clientY - (pool.top + pool.height / 2)) / (pool.height / 2);
      this.handlers.wireDrop(nx * nx + ny * ny <= 1);
    };
    this.wireEnd.addEventListener('pointerup', finish);
    this.wireEnd.addEventListener('pointercancel', finish);
    this.wireEnd.addEventListener('keydown', (event) => {
      if (this.step !== 'wire' || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      this.placeWireEnd(50, 74);
      this.handlers.wireDrop(true);
    });
  }

  dispose(): void {
    window.clearTimeout(this.narrationTimer);
    window.clearInterval(this.fishTimer);
  }
}
