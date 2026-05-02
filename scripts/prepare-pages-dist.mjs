import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const indexPath = join(root, 'dist', 'index.html');
const fallbackPath = join(root, 'dist', '404.html');

if (!existsSync(indexPath)) {
  console.error('dist/index.html がありません。先に npm run build を実行してください。');
  process.exit(1);
}

copyFileSync(indexPath, fallbackPath);
console.log('Prepared GitHub Pages SPA fallback: dist/404.html');
