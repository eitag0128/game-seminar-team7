// public/yoiyami/index.html を、ダブルクリックで開ける1ファイルのHTMLにして ../play/Yoiyami.html へ書き出す。
// 絵（img/）と効果音（se/）は data URL にしてHTMLの中に埋め込む。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'public', 'yoiyami');
const out = join(root, '..', 'play');
const types = { png: 'image/png', wav: 'audio/wav' };

const html = readFileSync(join(source, 'index.html'), 'utf8').replace(/(?:img|se)\/[\w-]+\.(png|wav)/g, (file, extension) =>
  `data:${types[extension]};base64,${readFileSync(join(source, file)).toString('base64')}`);
if (/['"`](?:img|se)\//.test(html)) throw new Error('埋め込めなかった素材の参照が残っています');

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'Yoiyami.html'), html);
console.log('play/Yoiyami.html');
