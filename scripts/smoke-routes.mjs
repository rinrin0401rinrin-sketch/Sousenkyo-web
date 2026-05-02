import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5174';
const chromeBin = process.env.CHROME_BIN ?? findChrome();

const routes = [
  {
    path: '/',
    includes: ['第50回 衆議院総選挙', '現在の選挙を見る', '選挙を選択', '政党別議席数'],
  },
  {
    path: '/elections/shugiin-50th',
    includes: ['第50回 衆議院総選挙', '全国ドットマップ', '都道府県リンク', '議員一覧'],
  },
  {
    path: '/elections/shugiin-50th/prefectures/tokyo',
    includes: ['東京都', '小選挙区と当選者', '選挙詳細へ戻る'],
  },
  {
    path: '/elections/shugiin-50th/members/aoi-sato',
    includes: ['佐藤 あおい', '未来政策党', '東京都'],
  },
  {
    path: '/elections/shugiin-49th',
    includes: ['データ準備中', '第49回 衆議院総選挙', 'トップへ戻る'],
  },
  {
    path: '/unknown-route',
    includes: ['ページが見つかりません'],
  },
];

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome',
    'chromium',
  ];

  return candidates.find((candidate) => candidate.includes('/') ? existsSync(candidate) : true);
}

async function dumpDom(url) {
  const { stdout } = await execFileAsync(chromeBin, [
    '--headless',
    '--disable-gpu',
    '--window-size=390,1200',
    '--virtual-time-budget=5000',
    '--dump-dom',
    url,
  ], {
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout;
}

const failures = [];

for (const route of routes) {
  const url = `${baseUrl}${route.path}`;
  try {
    const html = await dumpDom(url);
    const missing = route.includes.filter((text) => !html.includes(text));

    if (missing.length > 0) {
      failures.push(`${route.path}: ${missing.join(', ')} が見つかりません`);
      continue;
    }

    console.log(`OK ${route.path}`);
  } catch (error) {
    failures.push(`${route.path}: ${error.message}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`ERROR ${failure}`);
  process.exit(1);
}

console.log(`ルートスモークOK: ${routes.length} route(s)`);
