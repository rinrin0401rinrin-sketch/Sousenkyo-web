import { execFile } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const baseUrl = process.env.SCREENSHOT_BASE_URL ?? process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5174';
const chromeBin = process.env.CHROME_BIN ?? findChrome();
const timestamp = new Date().toISOString().replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
const outputDir = join(root, 'data', 'reports', 'screenshots', timestamp);

const shots = [
  ['home-desktop', '/', '1440,1800'],
  ['detail-desktop', '/elections/shugiin-50th', '1440,1800'],
  ['home-iphone', '/', '390,1400'],
  ['detail-iphone', '/elections/shugiin-50th', '390,1600'],
];

mkdirSync(outputDir, { recursive: true });

for (const [name, path, size] of shots) {
  const outputPath = join(outputDir, `${name}.png`);
  await execFileAsync(chromeBin, [
    '--headless',
    '--disable-gpu',
    `--window-size=${size}`,
    '--virtual-time-budget=5000',
    `--screenshot=${outputPath}`,
    `${baseUrl}${path}`,
  ], {
    maxBuffer: 10 * 1024 * 1024,
  });
  console.log(`Captured ${outputPath.replace(`${root}/`, '')}`);
}

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome',
    'chromium',
  ];

  return candidates.find((candidate) => candidate.includes('/') ? existsSync(candidate) : true);
}
