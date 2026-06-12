import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const indexPath = join(root, 'dist', 'index.html');
const fallbackPath = join(root, 'dist', '404.html');
const staticRoutes = [
  'live',
  'map',
  'parties',
  'proportional',
  'archive',
  'glossary',
  'unknown-route',
  'elections/shugiin-51st',
  'elections/shugiin-51st/prefectures/tokyo',
  'elections/shugiin-51st/members/aoyama-shigeharu',
  'elections/shugiin-50th',
  'elections/shugiin-50th/prefectures/tokyo',
  'elections/shugiin-50th/members/aoi-sato',
  'elections/shugiin-49th',
];

if (!existsSync(indexPath)) {
  console.error('dist/index.html がありません。先に npm run build を実行してください。');
  process.exit(1);
}

copyFileSync(indexPath, fallbackPath);
console.log('Prepared GitHub Pages SPA fallback: dist/404.html');

for (const route of staticRoutes) {
  const routeDir = join(root, 'dist', route);
  mkdirSync(routeDir, { recursive: true });
  copyFileSync(indexPath, join(routeDir, 'index.html'));
}
console.log(`Prepared GitHub Pages static route fallbacks: ${staticRoutes.length} route(s)`);
