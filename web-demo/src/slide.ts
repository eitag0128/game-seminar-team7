/**
 * マンホールのスライドパズル（3×3、空きマス1つ）。プランナー:
 * 「蓋の一部がずれている。移動可能なパネルを選択し、空いているマスへスライドさせる。模様が正しくつながればクリア」
 * 盤面は9マスの配列。値はパネル番号（正しい位置のマス番号）、null が空きマス。
 */
export type Board = readonly (number | null)[];

export const SIZE = 3;
export const SOLVED: Board = [0, 1, 2, 3, 4, 5, 6, 7, null];

function adjacent(a: number, b: number): boolean {
  const [ar, ac, br, bc] = [Math.floor(a / SIZE), a % SIZE, Math.floor(b / SIZE), b % SIZE];
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

/** マス index のパネルが空きマスの隣なら、空きマスへ動かした盤面を返す。動かせなければ同じ盤面。 */
export function slideTile(board: Board, index: number): Board {
  const empty = board.indexOf(null);
  if (board[index] === null || !adjacent(index, empty)) return board;
  const next = [...board];
  [next[index], next[empty]] = [next[empty], next[index]];
  return next;
}

export function isSolved(board: Board): boolean {
  return board.every((value, index) => value === SOLVED[index]);
}

export function movable(board: Board, index: number): boolean {
  return board[index] !== null && adjacent(index, board.indexOf(null));
}

/** 「蓋の一部がずれている」状態。完成から4手ずらしたので、マス 1 → 4 → 5 → 8 の順に戻せば解ける。 */
export const START: Board = [5, 4, 1, 0].reduce<Board>((board, index) => slideTile(board, index), SOLVED);
