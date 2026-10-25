import './style.css';
import { DEMO } from './config.ts';
import type { DrinkId } from './config.ts';
import { chooseDrink, closePuzzle, continueWalking, createGame, move, nearMachine, openPuzzle } from './progression.ts';
import type { GameState } from './progression.ts';
import { Street } from './street.ts';
import { Sound } from './audio.ts';
import { loopWhisper } from './loopEcho.ts';

const app = document.querySelector<HTMLElement>('#app')!;
app.innerHTML = `
  <div id="street" class="street"></div>
  <div class="vignette" aria-hidden="true"></div>
  <div id="loop-flash" class="loop-flash" aria-hidden="true"></div>
  <header class="masthead">
    <div><h1>Puzzle</h1><p>中央通り商店街</p></div>
    <div class="inventory" aria-label="記憶の断片"><span id="fragment" aria-hidden="true">◇</span><span id="inventory-count">0 / 1</span></div>
  </header>
  <button id="machine" class="machine-target" aria-label="自販機を調べる"><span>クリックして調べる</span></button>
  <p id="thought" class="thought" role="status">ここはどこだろう。</p>
  <p id="next-action" class="next-action" role="status"></p>
  <footer class="controls"><span><kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd> 歩く</span><button id="show-guide" class="help-button">遊び方</button><button id="sound-toggle" class="help-button" aria-pressed="true">音 オン</button><small>7班 · 仮素材デモ</small></footer>
  <dialog id="guide" class="guide-dialog" aria-labelledby="guide-title">
    <h2 id="guide-title">遊び方</h2>
    <p class="guide-goal">自販機のパズルを解くと、同じ道をくり返す街から先へ進めます。</p>
    <ol class="guide-steps">
      <li><strong>歩く</strong><p><kbd>←</kbd><kbd>→</kbd> または <kbd>A</kbd><kbd>D</kbd> で左右に移動します。<br>自販機は右のほうにあります。</p></li>
      <li><strong>調べる</strong><p>自販機の近くでクリックすると、<br>パズル画面が開きます。</p></li>
      <li><strong>見比べる</strong><p>鏡には飲み物が左右逆に映っています。<br><b>鏡と色が違う飲み物</b>を探して、<b>左側の缶の下のボタン</b>を押してください。</p></li>
    </ol>
    <p class="guide-after">解くと記憶の断片が手に入り、街の右端から先へ進めます。<br>この説明は画面下の「遊び方」でもう一度見られます。</p>
    <div class="start-choices">
      <button id="start-walking" class="text-button">音ありではじめる <span aria-hidden="true">→</span></button>
      <button id="start-walking-silent" class="text-button quiet">音なしではじめる</button>
    </div>
  </dialog>
  <dialog id="puzzle" class="puzzle-dialog" aria-labelledby="puzzle-title">
    <div class="dialog-top"><div><h2 id="puzzle-title">自動販売機</h2></div><button id="close-puzzle" class="close" aria-label="パズルを閉じる">×</button></div>
    <p class="puzzle-instruction">鏡には左右逆に映ります。<strong>色が違う飲み物</strong>を探して、<strong>左側のボタン</strong>を押してください。</p>
    <div class="comparison">
      <section class="cabinet" aria-label="自販機の飲料"><p class="cabinet-label">自販機</p><div id="real-drinks" class="drink-row"></div><div class="dispense"></div></section>
      <div class="mirror-edge" aria-hidden="true"></div>
      <section class="cabinet reflection" aria-label="鏡に映った飲料"><p class="cabinet-label">鏡</p><div id="mirror-drinks" class="drink-row"></div><div class="dispense"></div></section>
    </div>
    <p class="puzzle-whisper">缶の下の丸いボタンで選びます · 違っていたら別の飲み物を試せます · × / Esc で街に戻る</p>
  </dialog>
  <dialog id="memory" class="memory-dialog" aria-labelledby="memory-title">
    <div class="memory-shard" aria-hidden="true">◇</div><p class="eyebrow">記憶の断片 1 / 1</p>
    <h2 id="memory-title">小さいころ、雨の日にこの自販機でジュースを買ってもらった。</h2>
    <p id="memory-text">自販機が元に戻って、街のループが止まりました。<br>「街へ戻る」のあと、<b>→ / D で右端まで歩いてください</b>。</p>
    <button id="continue" class="text-button">街へ戻る <span aria-hidden="true">→</span></button>
  </dialog>
  <dialog id="ending" class="memory-dialog ending" aria-labelledby="ending-title">
    <h2 id="ending-title">デモはここまで</h2>
    <p>この先（次のエリア・ほかのパズル）はまだ作っていません。</p><button id="restart" class="text-button">もう一度遊ぶ <span aria-hidden="true">↺</span></button>
  </dialog>
  <section id="error" class="error" role="alert" hidden><h2>街を表示できませんでした</h2><p>WebGLが使えるPCブラウザで開いてください。</p><button id="reload" class="text-button">再読み込み</button></section>
`;

const machine = document.querySelector<HTMLButtonElement>('#machine')!;
const thought = document.querySelector<HTMLElement>('#thought')!;
const nextAction = document.querySelector<HTMLElement>('#next-action')!;
const guide = document.querySelector<HTMLDialogElement>('#guide')!;
const startWalking = document.querySelector<HTMLButtonElement>('#start-walking')!;
const startWalkingSilent = document.querySelector<HTMLButtonElement>('#start-walking-silent')!;
const puzzle = document.querySelector<HTMLDialogElement>('#puzzle')!;
const memory = document.querySelector<HTMLDialogElement>('#memory')!;
const ending = document.querySelector<HTMLDialogElement>('#ending')!;
const inventory = document.querySelector<HTMLElement>('#inventory-count')!;
const fragment = document.querySelector<HTMLElement>('#fragment')!;
const error = document.querySelector<HTMLElement>('#error')!;
const realDrinks = document.querySelector<HTMLElement>('#real-drinks')!;
const loopFlash = document.querySelector<HTMLElement>('#loop-flash')!;
const soundToggle = document.querySelector<HTMLButtonElement>('#sound-toggle')!;
const mirrorDrinks = document.querySelector<HTMLElement>('#mirror-drinks')!;
let state = createGame();
let street: Street | undefined;
let frame = 0;
let previousTime = performance.now();
let thoughtUntil = previousTime + 6000;
let disposed = false;
let noticedMachine = false;
const keys = new Set<string>();

function readSoundPreference(): boolean {
  try { return window.localStorage.getItem('puzzle-sound') !== 'off'; } catch { return true; }
}
const sound = new Sound(readSoundPreference());
function applySound(enabled: boolean): void {
  sound.setEnabled(enabled);
  try { window.localStorage.setItem('puzzle-sound', enabled ? 'on' : 'off'); } catch { /* 保存できなくても再生には影響しない */ }
  // ブラウザの自動再生制限があるため、必ずボタン操作の中で呼ぶ。音なしなら音声処理自体を始めない。
  if (enabled) sound.start();
  app.dataset.sound = !enabled ? 'off' : sound.started ? 'on' : 'unavailable';
  renderSoundToggle();
}
function renderSoundToggle(): void {
  soundToggle.textContent = sound.enabled ? '音 オン' : '音 オフ';
  soundToggle.setAttribute('aria-pressed', String(sound.enabled));
}
renderSoundToggle();
app.dataset.sound = 'off';
soundToggle.addEventListener('click', () => applySound(!sound.enabled));

function showGuide(): void {
  keys.clear();
  state = { ...state, moving: false };
  startWalking.innerHTML = '音ありではじめる <span aria-hidden="true">→</span>';
  startWalkingSilent.hidden = false;
  if (!guide.open) guide.showModal();
}
function hideGuide(): void {
  keys.clear();
  guide.close();
  whisper(state.repaired ? '→ / D で右へ進めます。' : '自販機は右のほうにあります。');
}
document.querySelector('#show-guide')!.addEventListener('click', () => {
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
  if (before.phase !== 'puzzle' && state.phase === 'puzzle') {
    sound.play('open');
    sound.setDimmed(true);
  }
  if (before.phase === 'puzzle' && state.phase !== 'puzzle') {
    sound.setDimmed(false);
  }
  if (before.phase !== 'memory' && state.phase === 'memory') sound.play('chime');
  if (state.loops > before.loops) {
    whisper(loopWhisper(state.loops));
    sound.play('loop');
    loopFlash.classList.remove('flash');
    void loopFlash.offsetWidth; // 連続したループでもアニメーションを最初から再生する
    loopFlash.classList.add('flash');
  }
  if (sound.lastCue) app.dataset.lastSound = sound.lastCue;
  if (before.phase === 'memory' && state.phase === 'street') whisper('→ / D で右へ進めます。', 7000);
  if (before.phase !== 'beyond' && state.phase === 'beyond') whisper('今度は元の場所に戻されなかった。', 7000);
}

function whisper(text: string, duration = 4500): void {
  thought.textContent = text;
  thoughtUntil = performance.now() + duration;
}

const onMachine = () => update(openPuzzle(state));
const onClose = () => update(closePuzzle(state));
const onContinue = () => update(continueWalking(state));
const onRestart = () => { keys.clear(); noticedMachine = false; update(createGame()); whisper('ここはどこだろう。'); };
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
  if (movementKeys.has(event.code) && !guide.open && (state.phase === 'street' || state.phase === 'beyond')) {
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
  if (guide.open) guide.close();
  error.hidden = false;
  machine.hidden = true;
  app.dataset.error = 'webgl';
}

function animate(now: number): void {
  if (disposed || !street || !error.hidden) return;
  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  const direction = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
  update(move(state, guide.open ? 0 : direction, dt));
  app.dataset.x = state.x.toFixed(3);
  const location = street.render(state, now / 1000, dt);
  machine.style.left = `${location.x}px`;
  machine.style.top = `${location.y}px`;
  machine.style.width = `${location.scale * 1.7}px`;
  machine.style.height = `${location.scale * 3.1}px`;
  machine.hidden = state.repaired || state.phase !== 'street' || guide.open;
  if (!noticedMachine && !state.repaired && nearMachine(state) && state.phase === 'street') {
    noticedMachine = true;
    whisper('この自販機、一部が白く抜けている。', 5000);
  }
  machine.disabled = !nearMachine(state);
  machine.classList.toggle('near', nearMachine(state));
  thought.classList.toggle('visible', now < thoughtUntil && state.phase !== 'puzzle');
  nextAction.hidden = guide.open || (state.phase !== 'street' && state.phase !== 'beyond');
  const instruction = state.repaired
    ? '→ / D で右端まで歩くと、先へ進めます。'
    : nearMachine(state)
      ? '自販機をクリックすると調べられます。'
      : '← → / A D で歩けます。自販機を探してください。';
  if (nextAction.textContent !== instruction) nextAction.textContent = instruction;
  frame = requestAnimationFrame(animate);
}

try {
  street = new Street(document.querySelector<HTMLElement>('#street')!, fail);
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
  sound.dispose();
}
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
