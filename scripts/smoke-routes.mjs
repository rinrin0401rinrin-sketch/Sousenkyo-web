import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5174';
const basePath = (process.env.SMOKE_BASE_PATH ?? '').replace(/\/$/, '');
const chromeBin = process.env.CHROME_BIN ?? findChrome();

const routes = [
  {
    path: '/',
    includes: ['第51回 衆議院総選挙', '候補者を探す', '選挙を選択', '政党別候補者数'],
  },
  {
    path: '/elections/shugiin-51st',
    includes: ['第51回 衆議院総選挙', '全国ドットマップ', '都道府県リンク', '候補者一覧'],
  },
  {
    path: '/elections/shugiin-51st/prefectures/tokyo',
    includes: ['東京', '小選挙区と当選者', '選挙詳細へ戻る'],
  },
  {
    path: '/elections/shugiin-51st/members/aoyama-shigeharu',
    includes: ['青山 繁晴', '自由民主党', '兵庫'],
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
    path: '/live',
    includes: ['開票速報', '速報タイムライン', '確定状況'],
  },
  {
    path: '/map',
    includes: ['全国マップ', '地図レイヤー', 'フィルター'],
  },
  {
    path: '/parties',
    includes: ['政党別データ', '政党別議席表', '小選挙区 / 比例内訳'],
  },
  {
    path: '/proportional',
    includes: ['比例代表', '比例ブロック', '比例復活'],
  },
  {
    path: '/archive',
    includes: ['過去選挙アーカイブ', '選挙回次', '単語帳で用語を確認'],
  },
  {
    path: '/glossary',
    includes: ['選挙単語帳', '検索辞書', '候補者名・選挙区・政党名で検索'],
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
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
    '--disable-extensions',
    '--disable-gpu',
    '--window-size=390,1200',
    '--virtual-time-budget=5000',
    '--dump-dom',
    url,
  ], {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 20000,
    killSignal: 'SIGKILL',
  });

  return stdout;
}

const failures = [];

for (const route of routes) {
  const url = `${baseUrl}${basePath}${route.path}`;
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
