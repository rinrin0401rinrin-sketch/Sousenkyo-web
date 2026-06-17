import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { assertInside, assertSafeElectionId, publicDataRoot, root, toDisplayPath, writeJson } from './data-utils.mjs';

const args = process.argv.slice(2);
const electionId = readOption('--election') ?? 'shugiin-51st';
const dryRun = args.includes('--dry-run');
const apply = args.includes('--apply');
const outputRoot = resolve(readOption('--output') ?? join(root, 'data', 'imports'));
const sourceDir = readOption('--source-dir');
const summaryUrl =
  readOption('--summary-url') ?? 'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/shiryo/kaiha_m.htm';
const sourceName = '衆議院 会派名及び会派別所属議員数';
const allowedHosts = ['www.shugiin.go.jp'];

assertSafeElectionId(electionId);
assertInside(root, outputRoot);
if (sourceDir) assertInside(root, resolve(sourceDir));

const caucusPages = [
  ['自民', '自由民主党・無所属の会', 'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/011kaiha.htm'],
  ['中道', '中道改革連合・無所属', 'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/020kaiha.htm'],
  ['維新', '日本維新の会', 'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/030kaiha.htm'],
  ['国民', '国民民主党・無所属クラブ', 'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/040kaiha.htm'],
  ['参政', '参政党', 'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/050kaiha.htm'],
  ['みらい', 'チームみらい', 'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/060kaiha.htm'],
  ['共産', '日本共産党', 'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/070kaiha.htm'],
  ['無所属', '無所属', 'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/999kaiha.htm'],
];

const stamp = timestamp();
const workDir = resolve(outputRoot, electionId, stamp, 'caucus');
assertInside(outputRoot, workDir);
const fetchedAt = new Date().toISOString();

const pages = new Map();
if (sourceDir) {
  pages.set(summaryUrl, readTextFile(resolve(sourceDir, 'kaiha_m.htm')));
  for (const [, , url] of caucusPages) {
    const fileName = url.split('/').pop();
    pages.set(url, readTextFile(resolve(sourceDir, fileName)));
  }
} else {
  for (const url of [summaryUrl, ...caucusPages.map(([, , url]) => url)]) {
    pages.set(url, await fetchOfficialHtml(url));
  }
}

const summaryHtml = pages.get(summaryUrl);
const summary = parseSummaryPage(summaryHtml);
const caucuses = caucusPages.map(([label, fallbackName, url]) => {
  const row = summary.rows.find((item) => item.label === label) ?? {};
  const memberHtml = pages.get(url) ?? '';
  const memberNames = parseMemberNames(memberHtml);
  return {
    label,
    name: row.name ?? fallbackName,
    count: row.count ?? memberNames.length,
    women: row.women ?? 0,
    sourceUrl: url,
    members: memberNames,
  };
});

const latest = {
  sourceName,
  sourceUrl: summaryUrl,
  asOfDate: summary.asOfDate,
  fetchedAt,
  electionId,
  caucuses,
};
validateLatest(latest);

const currentCandidates = readCurrentCandidates(electionId);
const report = buildDiffReport(latest, currentCandidates);

if (dryRun && !apply) {
  console.log(`Dry run: official caucus data parsed for ${electionId}`);
  console.log(`- ${latest.asOfDate}`);
  for (const caucus of latest.caucuses) {
    const diff = report.countDiffs.find((item) => item.label === caucus.label);
    console.log(`- ${caucus.label}: official=${caucus.count} current=${diff?.currentCount ?? 0} diff=${diff?.diff ?? caucus.count}`);
  }
  if (report.errors.length > 0) {
    for (const error of report.errors) console.error(`ERROR ${error}`);
    process.exit(1);
  }
  process.exit(0);
}

mkdirSync(workDir, { recursive: true });
writeJson(join(workDir, 'caucus-latest.json'), latest);
writeJson(join(workDir, 'caucus-diff-report.json'), report);
console.log(`Caucus import written: ${toDisplayPath(workDir)}`);

if (report.errors.length > 0) {
  for (const error of report.errors) console.error(`ERROR ${error}`);
  process.exit(1);
}

if (apply) {
  const outputPath = join(publicDataRoot, 'caucus', 'latest.json');
  assertInside(publicDataRoot, outputPath);
  writeJson(outputPath, latest);
  console.log(`Published caucus latest data: ${toDisplayPath(outputPath)}`);
}

function parseSummaryPage(html) {
  assertNotMaintenance(html, summaryUrl);
  const text = htmlToText(html);
  const asOfDate = text.match(/令和\s*[0-9元]+\s*年\s*[0-9]+\s*月\s*[0-9]+\s*日\s*現在/)?.[0]?.replace(/\s+/g, '') ?? '';
  if (!asOfDate) throw new Error('公式会派ページから基準日を取得できませんでした');

  const rows = [];
  for (const rowHtml of html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => htmlToText(match[1]));
    if (cells.length < 2) continue;
    const rowText = cells.join(' ');
    const label = inferCaucusLabel(rowText);
    if (!label) continue;
    const numbers = cells.flatMap((cell) => [...cell.matchAll(/[0-9０-９]+/g)].map((match) => toNumber(match[0])));
    const count = numbers[0];
    const women = numbers[1] ?? 0;
    if (!Number.isFinite(count)) continue;
    rows.push({
      label,
      name: cells[0],
      count,
      women,
    });
  }

  if (rows.length === 0) {
    for (const line of text.split(/\n+/)) {
      const label = inferCaucusLabel(line);
      if (!label) continue;
      const numbers = [...line.matchAll(/[0-9０-９]+/g)].map((match) => toNumber(match[0]));
      if (numbers.length === 0) continue;
      rows.push({ label, name: line.replace(/[0-9０-９（）() ]+/g, '').trim(), count: numbers[0], women: numbers[1] ?? 0 });
    }
  }

  return { asOfDate, rows };
}

function parseMemberNames(html) {
  if (!html) return [];
  assertNotMaintenance(html, '会派別議員一覧');
  const links = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => htmlToText(match[1]))
    .filter((text) => isLikelyMemberName(text));
  return [...new Set(links)];
}

function isLikelyMemberName(text) {
  if (!text || text.length < 2 || text.length > 12) return false;
  if (/[0-9０-９]/.test(text)) return false;
  if (/(トップ|戻る|衆議院|会派|議員|一覧|English|サイト|検索)/.test(text)) return false;
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);
}

function inferCaucusLabel(text) {
  if (/自由民主党|自民/.test(text)) return '自民';
  if (/中道改革連合|中道/.test(text)) return '中道';
  if (/日本維新|維新/.test(text)) return '維新';
  if (/国民民主党|国民/.test(text)) return '国民';
  if (/参政党|参政/.test(text)) return '参政';
  if (/チームみらい|みらい/.test(text)) return 'みらい';
  if (/日本共産党|共産/.test(text)) return '共産';
  if (/無所属/.test(text)) return '無所属';
  return undefined;
}

function validateLatest(latest) {
  if (!latest.asOfDate) throw new Error('asOfDate が空です');
  const labels = new Set();
  let total = 0;
  for (const caucus of latest.caucuses) {
    if (labels.has(caucus.label)) throw new Error(`会派ラベルが重複しています: ${caucus.label}`);
    labels.add(caucus.label);
    if (!Number.isSafeInteger(caucus.count) || caucus.count < 0) throw new Error(`${caucus.label}: count が不正です`);
    if (!Number.isSafeInteger(caucus.women) || caucus.women < 0) throw new Error(`${caucus.label}: women が不正です`);
    if (caucus.women > caucus.count) throw new Error(`${caucus.label}: women が count を超えています`);
    total += caucus.count;
  }
  if (total !== 465) throw new Error(`公式会派数合計が465ではありません: ${total}`);
}

function buildDiffReport(latest, candidates) {
  const currentCounts = new Map();
  for (const candidate of candidates) {
    const label = candidate.caucusLabel || '会派未設定';
    currentCounts.set(label, (currentCounts.get(label) ?? 0) + 1);
  }

  const countDiffs = latest.caucuses.map((caucus) => {
    const currentCount = currentCounts.get(caucus.label) ?? 0;
    currentCounts.delete(caucus.label);
    return {
      label: caucus.label,
      officialCount: caucus.count,
      currentCount,
      diff: currentCount - caucus.count,
    };
  });

  for (const [label, currentCount] of currentCounts) {
    countDiffs.push({ label, officialCount: 0, currentCount, diff: currentCount });
  }

  const errors = countDiffs
    .filter((item) => item.diff !== 0)
    .map((item) => `${item.label}: official=${item.officialCount}, current=${item.currentCount}, diff=${item.diff}`);

  return {
    electionId,
    generatedAt: new Date().toISOString(),
    sourceUrl: latest.sourceUrl,
    asOfDate: latest.asOfDate,
    totalOfficial: latest.caucuses.reduce((total, item) => total + item.count, 0),
    totalCurrent: candidates.length,
    countDiffs,
    errors,
  };
}

function readCurrentCandidates(electionId) {
  const path = join(publicDataRoot, 'glossary', 'candidates.json');
  const data = JSON.parse(readFileSync(path, 'utf8'));
  return (data.entries ?? []).filter((entry) => (entry.electionIds ?? []).includes(electionId));
}

async function fetchOfficialHtml(url) {
  const parsed = validateOfficialUrl(url);
  const response = await fetch(parsed.href, { redirect: 'manual' });
  if (!response.ok) throw new Error(`公式ページを取得できませんでした (${response.status}): ${parsed.href}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const html = decodeHtml(buffer, response.headers.get('content-type') ?? '');
  assertNotMaintenance(html, parsed.href);
  return html;
}

function validateOfficialUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`公式URLはhttpsのみ許可します: ${value}`);
  if (!allowedHosts.includes(url.hostname)) throw new Error(`許可されていない公式hostです: ${url.hostname}`);
  return url;
}

function decodeHtml(buffer, contentType) {
  const charset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase();
  const encoding = charset || 'shift_jis';
  try {
    return new TextDecoder(encoding).decode(buffer);
  } catch {
    return new TextDecoder('shift_jis').decode(buffer);
  }
}

function assertNotMaintenance(html, source) {
  const text = htmlToText(html);
  if (/メンテナンス中|under maintenance/i.test(text)) {
    throw new Error(`公式ページがメンテナンス表示です: ${source}`);
  }
}

function htmlToText(html) {
  return decodeEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|tr|li|div|table|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t\r\f\v]+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim(),
  );
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function toNumber(value) {
  const normalized = String(value).replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
  return Number(normalized);
}

function readTextFile(path) {
  if (!existsSync(path)) throw new Error(`HTML fixture がありません: ${toDisplayPath(path)}`);
  return readFileSync(path, 'utf8');
}

function readOption(name) {
  const exact = args.indexOf(name);
  if (exact >= 0) return args[exact + 1];
  const prefix = `${name}=`;
  const option = args.find((arg) => arg.startsWith(prefix));
  return option ? option.slice(prefix.length) : undefined;
}

function timestamp() {
  return new Date().toISOString().replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
}
