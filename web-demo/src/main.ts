import './style.css';
import { DEMO, DRINKS } from './config.ts';
import type { DrinkId, ObjectId } from './config.ts';
import {
  activeObject, chooseDrink, clickCan, closeDialog, createGame, dropWire, inspect, move, narrationDone, nearObject, solveManhole,
} from './progression.ts';
import type { GameState } from './progression.ts';
import { Street } from './street.ts';
import { Sound } from './audio.ts';
import { Brain } from './brain.ts';
import { START, isSolved, movable, slideTile } from './slide.ts';
import type { Board } from './slide.ts';
import { WRONG_DRINK } from './story.ts';

const OBJECTS: ObjectId[] = ['machine', 'pole', 'manhole'];
const OBJECT_NAMES: Record<ObjectId, string> = { machine: '自販機', pole: '電柱', manhole: 'マンホール' };
// 調べるボタンを重ねる位置（街の y 座標）と大きさ（街の単位）。
const TARGETS: Record<ObjectId, { y: number; w: number; h: number }> = {
  machine: { y: -1.3, w: 1.7, h: 3.1 },
  pole: { y: 0.6, w: 1.0, h: 6.5 },
  manhole: { y: -3.75, w: 2.0, h: 0.9 },
};

/** PROTOTYPE: マンホールの蓋の仮の絵。花と波の模様で、パネルがそろうと模様がつながる。 */
function manholeArt(): string {
  const petals = Array.from({ length: 5 }, (_, i) =>
    `<ellipse cx="150" cy="105" rx="22" ry="40" fill="#e6c9d6" stroke="#2a2f3f" stroke-width="3" transform="rotate(${i * 72} 150 150)"/>`).join('');
  const waves = [70, 230].map((y) => `<path d="M30 ${y}q30-24 60 0t60 0t60 0t60 0" fill="none" stroke="#9fb6d6" stroke-width="7"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
    <rect width="300" height="300" fill="#2c3a50"/>
    <circle cx="150" cy="150" r="146" fill="#55698a" stroke="#1a2232" stroke-width="6"/>
    <circle cx="150" cy="150" r="124" fill="#6b82a6" stroke="#2a3448" stroke-width="4"/>
    ${waves}${petals}<circle cx="150" cy="150" r="20" fill="#f0d264" stroke="#2a2f3f" stroke-width="3"/>
    <path d="M60 150h40M200 150h40M150 30v40" stroke="#2a3448" stroke-width="5"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const app = document.querySelector<HTMLElement>('#app')!;
app.innerHTML = `
  <section id="reality" class="pane reality" aria-label="現実の街">
    <div id="street" class="street"></div>
    <div class="vignette" aria-hidden="true"></div>
    <header class="masthead"><h1>Puzzle</h1><p>ステージ1 · 中央通り商店街</p></header>
    ${OBJECTS.map((id) => `<button id="inspect-${id}" class="inspect-target" aria-label="${OBJECT_NAMES[id]}を調べる" hidden><span><span class="for-keys">クリック</span><span class="for-touch">タップ</span>して調べる</span></button>`).join('')}
    <p id="thought" class="thought" role="status"></p>
    <p id="next-action" class="next-action" role="status"></p>
    <button id="touch-left" class="touch-move left" aria-label="左へ歩く">◀</button>
    <button id="touch-right" class="touch-move right" aria-label="右へ歩く">▶</button>
    <footer class="controls"><span class="for-keys"><kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd> 歩く</span><button id="show-guide" class="help-button">遊び方</button><button id="sound-toggle" class="help-button" aria-pressed="true">音 オン</button><small>7班 · 仮素材デモ</small></footer>
  </section>
  <section id="brain" class="pane brain" aria-label="頭の中"></section>
  <dialog id="guide" class="guide-dialog" aria-labelledby="guide-title">
    <h2 id="guide-title">遊び方</h2>
    <p class="guide-goal">左が現実の街、右が少女の頭の中です。現実で物を調べると頭の中が変わり、頭の中で起きたことが、次に調べる物の手がかりになります。</p>
    <ol class="guide-steps">
      <li><strong>歩く</strong><p><span class="for-keys"><kbd>←</kbd><kbd>→</kbd> または <kbd>A</kbd><kbd>D</kbd> で左右に移動します。</span><span class="for-touch">左の画面の下にある ◀ ▶ を押している間、左右に歩きます。</span></p></li>
      <li><strong>調べる</strong><p>物に近づいて「調べる」が出たら、<span class="for-keys">クリック</span><span class="for-touch">タップ</span>します。</p></li>
      <li><strong>頭の中</strong><p>右に出る文は、<span class="for-keys">クリック</span><span class="for-touch">タップ</span>すると次へ進みます。<br>頭の中の缶なども<span class="for-keys">クリック</span><span class="for-touch">タップ</span>できます。<b>電線の先はドラッグ</b>して動かします。</p></li>
    </ol>
    <p class="guide-after">この街は、端まで歩くと元の場所に戻ってしまいます。謎を3つ解くと、右端から先へ進めます。迷ったら、左の画面に出る案内を見てください。<br>この説明は画面下の「遊び方」でもう一度見られます。<span class="for-touch"><br>スマホは横向きにすると見やすくなります。</span></p>
    <div class="start-choices">
      <button id="start-walking" class="text-button">音ありではじめる <span aria-hidden="true">→</span></button>
      <button id="start-walking-silent" class="text-button quiet">音なしではじめる</button>
    </div>
  </dialog>
  <dialog id="vending" class="vending-dialog" aria-labelledby="vending-title">
    <div class="dialog-top"><h2 id="vending-title">自動販売機</h2><button class="close" data-close aria-label="自販機を閉じる">×</button></div>
    <p class="dialog-note">飲み物を1つ選んでください。</p>
    <div class="vending-front"><div class="drink-grid">${DRINKS.map((drink) => `<button class="drink-choice" data-drink="${drink.id}"><span class="can" style="--drink-color:${drink.color}"></span>${drink.name}</button>`).join('')}</div></div>
    <p id="vending-comment" class="vending-comment" role="status"></p>
  </dialog>
  <dialog id="slide" class="slide-dialog" aria-labelledby="slide-title">
    <div class="dialog-top"><h2 id="slide-title">マンホール</h2><button class="close" data-close aria-label="マンホールを閉じる">×</button></div>
    <p class="dialog-note">蓋の模様がずれています。空いているマスのとなりのパネルを押して動かし、模様をつなげてください。</p>
    <div id="slide-board" class="slide-board" style='--manhole:${manholeArt()}'></div>
  </dialog>
  <dialog id="ending" class="ending-dialog" aria-labelledby="ending-title">
    <h2 id="ending-title">ステージ1 クリア</h2>
    <p>この先（ステージ2）はまだ作っていません。</p>
    <button id="restart" class="text-button">もう一度遊ぶ <span aria-hidden="true">↺</span></button>
  </dialog>
  <section id="error" class="error" role="alert" hidden><h2>街を表示できませんでした</h2><p>WebGLが使えるブラウザで開いてください。</p><button id="reload" class="text-button">再読み込み</button></section>
`;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const thought = $<HTMLElement>('#thought');
const nextAction = $<HTMLElement>('#next-action');
const guide = $<HTMLDialogElement>('#guide');
const startWalking = $<HTMLButtonElement>('#start-walking');
const startWalkingSilent = $<HTMLButtonElement>('#start-walking-silent');
const vending = $<HTMLDialogElement>('#vending');
const vendingComment = $<HTMLElement>('#vending-comment');
const slide = $<HTMLDialogElement>('#slide');
const slideBoard = $<HTMLElement>('#slide-board');
const ending = $<HTMLDialogElement>('#ending');
const error = $<HTMLElement>('#error');
const soundToggle = $<HTMLButtonElement>('#sound-toggle');
const targets = Object.fromEntries(OBJECTS.map((id) => [id, $<HTMLButtonElement>(`#inspect-${id}`)])) as Record<ObjectId, HTMLButtonElement>;
const touchButtons = [$<HTMLButtonElement>('#touch-left'), $<HTMLButtonElement>('#touch-right')];

let state = createGame();
let street: Street | undefined;
let board: Board = START;
let frame = 0;
let previousTime = performance.now();
let thoughtUntil = 0;
let stepTimer = 0;
let introStarted = false;
let disposed = false;
const keys = new Set<string>();

function whisper(text: string, duration = 4000): void {
  thought.textContent = text;
  thoughtUntil = performance.now() + duration;
}

// 音: 始める時に音あり/音なしを選ぶ。音なしなら音声処理自体を始めない。
function readSoundPreference(): boolean {
  try { return window.localStorage.getItem('puzzle-sound') !== 'off'; } catch { return true; }
}
const sound = new Sound(readSoundPreference());
function renderSoundToggle(): void {
  soundToggle.textContent = sound.enabled ? '音 オン' : '音 オフ';
  soundToggle.setAttribute('aria-pressed', String(sound.enabled));
}
function applySound(enabled: boolean): void {
  sound.setEnabled(enabled);
  try { window.localStorage.setItem('puzzle-sound', enabled ? 'on' : 'off'); } catch { /* 保存できなくても再生には影響しない */ }
  if (enabled) sound.start();
  app.dataset.sound = !enabled ? 'off' : sound.started ? 'on' : 'unavailable';
  renderSoundToggle();
}
function play(cue: Parameters<Sound['play']>[0]): void {
  sound.play(cue);
  if (sound.lastCue) app.dataset.lastSound = sound.lastCue;
}
renderSoundToggle();
app.dataset.sound = 'off';
soundToggle.addEventListener('click', () => applySound(!sound.enabled));

// 入力: スマホ・タブレットでは画面の ◀ ▶ で歩く。キーを押せばキー操作の案内に戻る。
let touchUI = window.matchMedia('(pointer: coarse)').matches;
function setInputMode(touch: boolean): void {
  touchUI = touch;
  app.dataset.input = touch ? 'touch' : 'keys';
}
setInputMode(touchUI);
window.addEventListener('pointerdown', (event) => { if (event.pointerType === 'touch' && !touchUI) setInputMode(true); }, { capture: true });
function bindHold(button: HTMLButtonElement, code: string): void {
  const release = () => { keys.delete(code); button.classList.remove('held'); };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (guide.open || (state.phase !== 'street' && state.phase !== 'beyond')) return;
    try { button.setPointerCapture(event.pointerId); } catch { /* 指が外れても pointerup で止まる */ }
    keys.add(code);
    button.classList.add('held');
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) button.addEventListener(type, release);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}
bindHold(touchButtons[0], 'TouchLeft');
bindHold(touchButtons[1], 'TouchRight');

const brain = new Brain($<HTMLElement>('#brain'), {
  canClick() {
    const next = clickCan(state);
    if (next === state) return;
    if (next.grains > state.grains) brain.spawnGrain();
    play('select');
    update(next);
  },
  wireDrop(inWater) {
    const next = dropWire(state, inWater);
    if (next !== state) play('shock');
    else if (!inWater) whisper('水まで届いていない。', 2500);
    update(next);
  },
  narrationDone(step) { update(narrationDone(state, step)); },
});

function showGuide(): void {
  keys.clear();
  state = { ...state, moving: false };
  if (!guide.open) guide.showModal();
  // 背の低い画面では、開いた直後に下の開始ボタンまでスクロールされるので先頭に戻す。
  guide.scrollTop = 0;
}
function hideGuide(): void {
  keys.clear();
  guide.close();
  if (!introStarted) { introStarted = true; brain.start(); }
}
$<HTMLButtonElement>('#show-guide').addEventListener('click', () => {
  showGuide();
  // 途中で開いた時は音の設定を変えずに戻る。
  startWalking.innerHTML = 'ゲームに戻る <span aria-hidden="true">→</span>';
  startWalkingSilent.hidden = true;
});
startWalking.addEventListener('click', () => {
  if (!startWalkingSilent.hidden) applySound(true);
  hideGuide();
});
startWalkingSilent.addEventListener('click', () => { applySound(false); hideGuide(); });
guide.addEventListener('cancel', (event) => { event.preventDefault(); hideGuide(); });

function renderBoard(): void {
  slideBoard.innerHTML = board.map((tile, index) => {
    if (tile === null) return '<span class="slide-tile empty" aria-hidden="true"></span>';
    const position = `${(tile % 3) * 50}% ${Math.floor(tile / 3) * 50}%`;
    return `<button class="slide-tile${movable(board, index) ? ' movable' : ''}" data-index="${index}" style="background-position:${position}" aria-label="パネル${tile + 1}"></button>`;
  }).join('');
}

function update(next: GameState): void {
  const before = state;
  state = next;
  app.dataset.phase = state.phase;
  app.dataset.step = state.step;
  app.dataset.grains = String(state.grains);
  if (before.phase !== 'vending' && state.phase === 'vending') vendingComment.textContent = '';
  if (before.phase !== 'slide' && state.phase === 'slide') {
    board = START;
    slideBoard.classList.remove('solved');
    renderBoard();
  }
  const dialogs = [[vending, 'vending'], [slide, 'slide'], [ending, 'ending']] as const;
  for (const [dialog, phase] of dialogs) {
    if (state.phase === phase && !dialog.open) { keys.clear(); dialog.showModal(); }
    else if (state.phase !== phase && dialog.open) dialog.close();
  }
  sound.setDimmed(state.phase === 'vending' || state.phase === 'slide');
  brain.setStep(state.step);
  app.dataset.loops = String(state.loops);
  if (state.loops > before.loops) whisper(state.loops === 1 ? 'あれ、さっきの場所に戻ってる。' : 'またここに戻ってきた。', 3500);
  if (before.phase !== 'ending' && state.phase === 'ending') play('warp');
}

const onRestart = () => { keys.clear(); update(createGame()); };
for (const id of OBJECTS) {
  targets[id].addEventListener('click', () => {
    const next = inspect(state, id);
    if (next === state) return;
    play('select');
    update(next);
  });
}
for (const dialog of [vending, slide]) {
  dialog.querySelector('[data-close]')!.addEventListener('click', () => update(closeDialog(state)));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); update(closeDialog(state)); });
}
vending.querySelector('.drink-grid')!.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-drink]');
  if (!button) return;
  const next = chooseDrink(state, button.dataset.drink as DrinkId);
  if (next === state) {
    // 違う飲み物は何も起きず、一言だけ（プランナー:「それ以外は好きじゃないってコメントされる」）。
    vendingComment.textContent = WRONG_DRINK;
    vendingComment.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    play('wrong');
    return;
  }
  play('vending');
  update(next);
});
slideBoard.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-index]');
  if (!button || slideBoard.classList.contains('solved')) return;
  const index = Number(button.dataset.index);
  if (!movable(board, index)) return;
  board = slideTile(board, index);
  play('select');
  renderBoard();
  if (isSolved(board)) {
    slideBoard.classList.add('solved');
    play('correct');
    window.setTimeout(() => update(solveManhole(state)), 900);
  }
});
ending.addEventListener('cancel', (event) => event.preventDefault());
$<HTMLButtonElement>('#restart').addEventListener('click', onRestart);
$<HTMLButtonElement>('#reload').addEventListener('click', () => window.location.reload());

const movementKeys = new Set(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD']);
function onKeyDown(event: KeyboardEvent): void {
  if (movementKeys.has(event.code) && !guide.open && (state.phase === 'street' || state.phase === 'beyond')) {
    event.preventDefault();
    keys.add(event.code);
    if (touchUI) setInputMode(false);
  }
}
function onKeyUp(event: KeyboardEvent): void { keys.delete(event.code); }
function clearInput(): void { keys.clear(); previousTime = performance.now(); }
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);

function fail(): void {
  cancelAnimationFrame(frame);
  keys.clear();
  if (guide.open) guide.close();
  error.hidden = false;
  app.dataset.error = 'webgl';
}

/** 画面下の案内。今やることを1つだけ出す。 */
function instruction(): string {
  const walk = touchUI ? '◀ ▶' : '← → / A D';
  const tap = touchUI ? 'タップ' : 'クリック';
  const find = (id: ObjectId) => nearObject(state, id)
    ? `${OBJECT_NAMES[id]}を${tap}して調べてください。`
    : `${walk} で歩いて、${OBJECT_NAMES[id]}を探してください。`;
  switch (state.step) {
    case 'intro': case 'drained': case 'flooded': case 'shocked':
      return `右の頭の中に出る文を読んでください。文を${tap}すると次へ進みます。`;
    case 'machine': return find('machine');
    case 'choose': return nearObject(state, 'machine')
      ? `頭の中の缶を${tap}してみてください。わかったら自販機で飲み物を選びます。`
      : `頭の中の缶を${tap}してみてください。自販機で飲み物を選べます。`;
    case 'pour': return `頭の中の缶を${tap}してください。`;
    case 'manhole': return find('manhole');
    case 'pole': return find('pole');
    case 'wire': return '頭の中の電線の先を、水までドラッグしてください。';
    case 'exit': return `${touchUI ? '▶' : '→ / D'} で右端まで歩くと、先へ進めます。`;
  }
}

function animate(now: number): void {
  if (disposed || !street || !error.hidden) return;
  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  const direction = Number(keys.has('ArrowRight') || keys.has('KeyD') || keys.has('TouchRight'))
    - Number(keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('TouchLeft'));
  update(move(state, guide.open ? 0 : direction, dt));
  app.dataset.x = state.x.toFixed(3);
  street.render(state, now / 1000, dt);
  // 足音（歩いている間、一定の間隔で）。
  stepTimer = state.moving ? stepTimer + dt : 0.25;
  if (stepTimer >= 0.32) { stepTimer = 0; play('step'); }
  const walking = !guide.open && (state.phase === 'street' || state.phase === 'beyond');
  const active = activeObject(state);
  for (const id of OBJECTS) {
    const button = targets[id];
    button.hidden = !walking || active !== id;
    if (button.hidden) continue;
    const target = TARGETS[id];
    const point = street.project(DEMO.objects[id], target.y);
    button.style.left = `${point.x}px`;
    button.style.top = `${point.y}px`;
    button.style.width = `${point.scale * target.w}px`;
    button.style.height = `${point.scale * target.h}px`;
    const near = nearObject(state, id);
    button.disabled = !near;
    button.classList.toggle('near', near);
  }
  thought.classList.toggle('visible', now < thoughtUntil);
  nextAction.hidden = !walking;
  touchButtons.forEach((button) => { button.hidden = !walking; });
  const text = instruction();
  if (nextAction.textContent !== text) nextAction.textContent = text;
  frame = requestAnimationFrame(animate);
}

try {
  street = new Street($<HTMLElement>('#street'), fail);
  update(state);
  showGuide();
  frame = requestAnimationFrame(animate);
} catch (cause) {
  console.error('Puzzle renderer initialization failed', cause);
  fail();
}

function dispose(): void {
  disposed = true;
  cancelAnimationFrame(frame);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('blur', clearInput);
  document.removeEventListener('visibilitychange', clearInput);
  street?.dispose();
  brain.dispose();
  sound.dispose();
}
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
