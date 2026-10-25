// `npm run build` の結果を、ダブルクリックで開ける1ファイルのHTMLにまとめて ../play/ へ書き出す。
// file:// では外部の module スクリプトを読めないため、JS と CSS をHTMLの中に埋め込む。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, '..', 'play');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/, (_, file) => {
  const js = readFileSync(join(dist, file), 'utf8').replaceAll('</script', '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/, (_, file) =>
  `<style>${readFileSync(join(dist, file), 'utf8')}</style>`);
if (/(src|href)="\.\/assets\//.test(html)) throw new Error('埋め込めなかった assets の参照が残っています');

mkdirSync(out, { recursive: true });
const files = [
  ['Puzzle_発表モード.html', 'present'],
  ['Puzzle_説明あり.html', 'guided'],
];
for (const [name, mode] of files) {
  writeFileSync(join(out, name), html.replace('<html lang="ja">', `<html lang="ja" data-play-mode="${mode}">`));
  console.log(`play/${name}`);
}
