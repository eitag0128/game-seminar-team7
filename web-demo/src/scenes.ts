import { START, isSolved, movable, slideTile } from './slide.ts';
import type { Board } from './slide.ts';

/**
 * ステージ1の後の話（さりー案 2026-11-02 を骨組みにした仮版）。絵・文・遊びは全部仮。
 * 1つの画面に、背景の絵・文・押せる物・選択肢を出して進める。
 */
export type SceneArt = 'event' | 'alley' | 'park';

const ART: Record<SceneArt, string> = {
  // 商店街の続き。右側に路地の入口、左から友達が歩いてくる。
  event: `<svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="400" height="225" fill="#0d1733"/>
    <rect x="0" y="40" width="250" height="140" fill="#1b2747"/><rect x="290" y="30" width="110" height="150" fill="#1b2747"/>
    <rect x="250" y="40" width="40" height="140" fill="#060b1a"/>
    ${[10, 70, 130, 190].map((x) => `<rect x="${x}" y="90" width="52" height="70" fill="#26355a"/><path d="M${x} ${96 + 0}h52M${x} 104h52M${x} 112h52M${x} 120h52" stroke="#1b2747" stroke-width="2"/>`).join('')}
    <rect x="0" y="180" width="400" height="45" fill="#141d36"/>
    <circle cx="330" cy="70" r="5" fill="#f0e4bc"/><path d="M330 75v105" stroke="#3a4656" stroke-width="3"/>
  </svg>`,
  // 細い路地。壁とパイプ。
  alley: `<svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="400" height="225" fill="#0a1229"/>
    <path d="M0 0h130l40 225H0z" fill="#1d2a48"/><path d="M400 0H270l-40 225h170z" fill="#1d2a48"/>
    <path d="M170 0h60l10 225h-80z" fill="#121b35"/>
    <path d="M20 60h100M30 120h110M10 180h140" stroke="#41536f" stroke-width="7"/>
    <path d="M280 50h110M270 110h120M260 170h130" stroke="#41536f" stroke-width="7"/>
    <rect x="300" y="30" width="22" height="16" fill="#f0e4bc" opacity="0.6"/>
  </svg>`,
  // 夜の公園。ブランコとベンチと街灯。
  park: `<svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="400" height="225" fill="#0d1733"/><circle cx="320" cy="45" r="16" fill="#f6e7a1"/>
    <rect x="0" y="170" width="400" height="55" fill="#17233f"/>
    <path d="M60 170l25-90l25 90M135 170l25-90l25 90M85 80h75" stroke="#55657a" stroke-width="5" fill="none"/>
    <path d="M105 80v60M120 80v60M100 140h25" stroke="#8aa0b8" stroke-width="2.5"/>
    <rect x="240" y="140" width="90" height="10" fill="#6b5545"/><path d="M248 150v20M322 150v20" stroke="#6b5545" stroke-width="5"/>
    <path d="M370 170V70" stroke="#3a4656" stroke-width="4"/><circle cx="370" cy="66" r="7" fill="#f0e4bc"/>
  </svg>`,
};

// 路地で猫がいる場所（画面に対する %）。押すたびに次の場所へ跳ぶ。
const CAT_SPOTS = [{ x: 22, y: 70 }, { x: 74, y: 44 }, { x: 30, y: 24 }, { x: 52, y: 58 }];

/** 公園で友達と解くパズルの絵（仮）。月と星がそろう。 */
function starArt(): string {
  const stars = [[60, 70], [240, 60], [150, 140], [80, 230], [230, 220], [150, 40]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#f6e7a1"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="#1b2a52"/>
    <path d="M60 70L150 140L240 60M150 140L80 230M150 140L230 220M150 40V140" fill="none" stroke="#9fb6d6" stroke-width="4"/>${stars}
    <circle cx="150" cy="150" r="120" fill="none" stroke="#e6c9d6" stroke-width="6"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export class Scenes {
  private root: HTMLElement;
  private art: HTMLElement;
  private line: HTMLButtonElement;
  private choices: HTMLElement;
  private stage: HTMLElement;
  private advance: (() => void) | null = null;
  private timer = 0;

  constructor(host: HTMLElement, private onSound: (cue: 'select' | 'correct') => void) {
    host.innerHTML = `
      <div class="scene-art"></div>
      <div class="scene-stage"></div>
      <span class="art-note">仮の絵・仮の文</span>
      <button class="scene-line subtitle" type="button" aria-live="polite"></button>
      <div class="scene-choices"></div>`;
    this.root = host;
    this.art = host.querySelector('.scene-art')!;
    this.stage = host.querySelector('.scene-stage')!;
    this.line = host.querySelector('.scene-line')!;
    this.choices = host.querySelector('.scene-choices')!;
    this.line.addEventListener('click', () => this.advance?.());
  }

  show(art: SceneArt, label: string): void {
    this.root.hidden = false;
    this.root.dataset.scene = art;
    this.root.setAttribute('aria-label', label);
    this.art.innerHTML = ART[art];
    this.stage.innerHTML = '';
    this.choices.innerHTML = '';
  }

  hide(): void {
    window.clearTimeout(this.timer);
    this.advance = null;
    this.root.hidden = true;
    this.root.classList.remove('narrating');
    delete this.root.dataset.scene;
  }

  /** 文を1行ずつ出す。クリックで次へ、放っておいても進む。 */
  async say(lines: readonly string[]): Promise<void> {
    for (const text of lines) {
      this.line.textContent = text;
      this.root.classList.add('narrating');
      this.line.classList.remove('line-in');
      void this.line.offsetWidth;
      this.line.classList.add('line-in');
      await new Promise<void>((resolve) => {
        this.advance = () => { window.clearTimeout(this.timer); this.advance = null; resolve(); };
        this.timer = window.setTimeout(() => this.advance?.(), 3400);
      });
    }
    this.root.classList.remove('narrating');
  }

  /** 画面に人影を出す。walk なら左から右へ歩いていく（友達が通り過ぎる）。 */
  figure(kind: 'friend' | 'friend-walk', x = 50): void {
    const person = document.createElement('span');
    person.className = `scene-figure ${kind}`;
    person.style.left = `${x}%`;
    this.stage.append(person);
  }

  /** 路地の猫。押すと鳴いて次の場所へ跳ぶ。最後の場所まで行くと終わる。 */
  async cat(): Promise<void> {
    const cat = document.createElement('button');
    cat.className = 'scene-cat';
    cat.type = 'button';
    cat.setAttribute('aria-label', '猫');
    cat.innerHTML = '<span class="bubble">にゃあ</span>';
    this.stage.append(cat);
    for (let spot = 0; spot < CAT_SPOTS.length; spot++) {
      cat.style.left = `${CAT_SPOTS[spot].x}%`;
      cat.style.top = `${CAT_SPOTS[spot].y}%`;
      this.root.dataset.cat = String(spot);
      if (spot === CAT_SPOTS.length - 1) break;
      await new Promise<void>((resolve) => cat.addEventListener('click', () => resolve(), { once: true }));
      this.onSound('select');
      cat.classList.remove('meow');
      void cat.offsetWidth;
      cat.classList.add('meow');
    }
  }

  async choose(options: readonly string[]): Promise<number> {
    this.choices.innerHTML = options.map((text, index) => `<button class="text-button" data-choice="${index}">${text}</button>`).join('');
    return new Promise((resolve) => {
      this.choices.addEventListener('click', (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-choice]');
        if (!button) return;
        this.choices.innerHTML = '';
        this.onSound('select');
        resolve(Number(button.dataset.choice));
      });
    });
  }

  /** 公園で友達と解くスライドパズル（マンホールと同じ仕組み、絵だけ違う）。 */
  async puzzle(): Promise<void> {
    let board: Board = START;
    const wrap = document.createElement('div');
    wrap.className = 'scene-puzzle';
    wrap.innerHTML = '<p class="dialog-note">星の線がずれています。空いているマスのとなりのパネルを押して、線をつなげてください。</p><div class="slide-board"></div>';
    const grid = wrap.querySelector<HTMLElement>('.slide-board')!;
    grid.style.setProperty('--manhole', starArt());
    this.stage.append(wrap);
    const render = () => {
      grid.innerHTML = board.map((tile, index) => tile === null
        ? '<span class="slide-tile empty" aria-hidden="true"></span>'
        : `<button class="slide-tile${movable(board, index) ? ' movable' : ''}" data-index="${index}" style="background-position:${(tile % 3) * 50}% ${Math.floor(tile / 3) * 50}%" aria-label="星のパネル${tile + 1}"></button>`).join('');
    };
    render();
    await new Promise<void>((resolve) => {
      grid.addEventListener('click', (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-index]');
        if (!button || grid.classList.contains('solved') || !movable(board, Number(button.dataset.index))) return;
        board = slideTile(board, Number(button.dataset.index));
        this.onSound('select');
        render();
        if (isSolved(board)) {
          grid.classList.add('solved');
          this.onSound('correct');
          window.setTimeout(resolve, 900);
        }
      });
    });
    wrap.remove();
  }
}
