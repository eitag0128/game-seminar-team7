import './style.css';
import { DEMO } from './config.ts';
import type { DrinkId } from './config.ts';
import { chooseDrink, closePuzzle, continueWalking, createGame, move, nearMachine, openPuzzle } from './progression.ts';
import type { GameState } from './progression.ts';
import { Street } from './street.ts';

const app = document.querySelector<HTMLElement>('#app')!;
app.innerHTML = `
  <div id="street" class="street"></div>
  <div class="vignette" aria-hidden="true"></div>
  <header class="masthead">
    <div><h1>Puzzle</h1><p>夜凪商店街</p></div>
    <div class="inventory" aria-label="記憶の断片"><span id="fragment" aria-hidden="true">◇</span><span id="inventory-count">0 / 1</span></div>
  </header>
  <button id="machine" class="machine-target" aria-label="自販機を調べる"><span>自販機を調べる</span></button>
  <p id="thought" class="thought" role="status">知らない街。どこか、懐かしい。</p>
  <footer class="controls"><span><kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd> 歩く</span><span>自販機をクリックして調べる</span><small>7班 · 仮素材デモ</small></footer>
  <dialog id="puzzle" class="puzzle-dialog" aria-labelledby="puzzle-title">
    <div class="dialog-top"><div><p class="eyebrow">夜に残されたもの</p><h2 id="puzzle-title">自動販売機</h2></div><button id="close-puzzle" class="close" aria-label="パズルを閉じる">×</button></div>
    <div class="comparison">
      <section class="cabinet" aria-label="自販機の飲料"><p class="cabinet-label">こちら側</p><div id="real-drinks" class="drink-row"></div><div class="dispense"></div></section>
      <div class="mirror-edge" aria-hidden="true"></div>
      <section class="cabinet reflection" aria-label="鏡に映った飲料"><p class="cabinet-label">鏡の向こう</p><div id="mirror-drinks" class="drink-row"></div><div class="dispense"></div></section>
    </div>
    <p class="puzzle-whisper">映っているのは、同じもの？</p>
  </dialog>
  <dialog id="memory" class="memory-dialog" aria-labelledby="memory-title">
    <div class="memory-shard" aria-hidden="true">◇</div><p class="eyebrow">記憶の断片 01</p>
    <h2 id="memory-title">雨の匂いを、覚えている。</h2>
    <p>欠けていたものが、少しだけ戻った。<br>街の先へ、歩いてみよう。</p>
    <button id="continue" class="text-button">街へ戻る <span aria-hidden="true">→</span></button>
  </dialog>
  <dialog id="ending" class="memory-dialog ending" aria-labelledby="ending-title">
    <p class="eyebrow">雨は、まだ降っている。</p><h2 id="ending-title">知らない道が、続いている。</h2>
    <p>ここまでが今回のデモです。</p><button id="restart" class="text-button">もう一度歩く <span aria-hidden="true">↺</span></button>
  </dialog>
  <section id="error" class="error" role="alert" hidden><h2>街を表示できませんでした</h2><p>WebGLが使えるPCブラウザで開いてください。</p><button id="reload" class="text-button">再読み込み</button></section>
`;

const machine = document.querySelector<HTMLButtonElement>('#machine')!;
const thought = document.querySelector<HTMLElement>('#thought')!;
const puzzle = document.querySelector<HTMLDialogElement>('#puzzle')!;
const memory = document.querySelector<HTMLDialogElement>('#memory')!;
const ending = document.querySelector<HTMLDialogElement>('#ending')!;
const inventory = document.querySelector<HTMLElement>('#inventory-count')!;
const fragment = document.querySelector<HTMLElement>('#fragment')!;
const error = document.querySelector<HTMLElement>('#error')!;
const realDrinks = document.querySelector<HTMLElement>('#real-drinks')!;
const mirrorDrinks = document.querySelector<HTMLElement>('#mirror-drinks')!;
let state = createGame();
let street: Street | undefined;
let frame = 0;
let previousTime = performance.now();
let thoughtUntil = previousTime + 6000;
let disposed = false;
const keys = new Set<string>();

function drinkMarkup(drink: (typeof DEMO.drinks)[number], reflected: boolean): string {
  const color = reflected ? drink.reflectionColor : drink.color;
  return `<div class="drink" data-drink="${drink.id}">
    <div class="can ${reflected ? 'mirrored-can' : ''}" style="--drink-color:${color}"><span class="can-mark">${drink.name}</span></div>
    ${reflected ? '<span class="mirror-switch" aria-hidden="true"></span>' : `<button class="drink-switch" data-choice="${drink.id}" aria-label="${drink.name}のスイッチ"></button>`}
  </div>`;
}
realDrinks.innerHTML = DEMO.drinks.map((drink) => drinkMarkup(drink, false)).join('');
mirrorDrinks.innerHTML = [...DEMO.drinks].reverse().map((drink) => drinkMarkup(drink, true)).join('');

function update(next: GameState): void {
  const before = state;
  state = next;
  app.dataset.phase = state.phase;
  app.dataset.loops = String(state.loops);
  app.dataset.repaired = String(state.repaired);
  app.dataset.fragments = String(state.fragments);
  inventory.textContent = `${state.fragments} / 1`;
  fragment.textContent = state.repaired ? '◆' : '◇';
  fragment.classList.toggle('collected', state.repaired);
  document.body.classList.toggle('repaired', state.repaired);
  const dialogs = [[puzzle, 'puzzle'], [memory, 'memory'], [ending, 'ending']] as const;
  for (const [dialog, phase] of dialogs) {
    if (state.phase === phase && !dialog.open) { keys.clear(); dialog.showModal(); }
    else if (state.phase !== phase && dialog.open) dialog.close();
  }
  if (before.loops !== state.loops) whisper('……また、同じ場所。');
  if (before.phase === 'memory' && state.phase === 'street') whisper('あの灯りの先へ。', 7000);
  if (before.phase !== 'beyond' && state.phase === 'beyond') whisper('今度は、戻らなかった。', 7000);
}

function whisper(text: string, duration = 4500): void {
  thought.textContent = text;
  thoughtUntil = performance.now() + duration;
}

const onMachine = () => update(openPuzzle(state));
const onClose = () => update(closePuzzle(state));
const onContinue = () => update(continueWalking(state));
const onRestart = () => { keys.clear(); update(createGame()); whisper('知らない街。どこか、懐かしい。'); };
machine.addEventListener('click', onMachine);
document.querySelector('#close-puzzle')!.addEventListener('click', onClose);
document.querySelector('#continue')!.addEventListener('click', onContinue);
document.querySelector('#restart')!.addEventListener('click', onRestart);
document.querySelector('#reload')!.addEventListener('click', () => window.location.reload());
realDrinks.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-choice]');
  if (button) update(chooseDrink(state, button.dataset.choice as DrinkId));
});
puzzle.addEventListener('cancel', (event) => { event.preventDefault(); onClose(); });
memory.addEventListener('cancel', (event) => { event.preventDefault(); onContinue(); });
ending.addEventListener('cancel', (event) => { event.preventDefault(); });

const movementKeys = new Set(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD']);
function onKeyDown(event: KeyboardEvent): void {
  if (movementKeys.has(event.code) && (state.phase === 'street' || state.phase === 'beyond')) {
    event.preventDefault(); keys.add(event.code);
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
  error.hidden = false;
  machine.hidden = true;
  app.dataset.error = 'webgl';
}

function animate(now: number): void {
  if (disposed || !street || !error.hidden) return;
  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  const direction = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
  update(move(state, direction, dt));
  app.dataset.x = state.x.toFixed(3);
  const location = street.render(state, now / 1000, dt);
  machine.style.left = `${location.x}px`;
  machine.style.top = `${location.y}px`;
  machine.style.width = `${location.scale * 1.7}px`;
  machine.style.height = `${location.scale * 3.1}px`;
  machine.hidden = state.repaired || state.phase !== 'street';
  machine.disabled = !nearMachine(state);
  machine.classList.toggle('near', nearMachine(state));
  thought.classList.toggle('visible', now < thoughtUntil && state.phase !== 'puzzle');
  frame = requestAnimationFrame(animate);
}

try {
  street = new Street(document.querySelector<HTMLElement>('#street')!, fail);
  update(state);
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
}
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
