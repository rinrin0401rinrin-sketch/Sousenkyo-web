import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const electionId = args.find((arg) => !arg.startsWith('--')) ?? readActiveElectionId();
const scanTargets = [
  join(root, 'public', 'data', electionId),
  join(root, 'data', 'source', 'elections', electionId),
  join(root, 'data', 'source', 'glossary', 'csv'),
  join(root, 'data', 'source', 'materials'),
];
const terms = [
  ['TODO', /\bTODO\b/i],
  ['FIXME', /\bFIXME\b/i],
  ['sample', /\bsample\b/i],
  ['dummy', /\bdummy\b/i],
  ['サンプル', /サンプル/],
  ['ダミー', /ダミー/],
  ['内部メモ', /内部メモ/],
  ['未許諾', /未許諾/],
  ['出典不明', /出典不明/],
];
const personalInfoPatterns = [
  ['email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ['phone-like', /(?:\+81[-\s]?)?0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/],
];

if (!existsSync(scanTargets[0])) {
  console.error(`public/data/${electionId} がありません`);
  process.exit(1);
}

const findings = [];
for (const target of scanTargets) scanPath(target);

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`ERROR ${finding.file}:${finding.line}: ${finding.term}`);
  }
  console.error(`\n公開対象データに仮表記が残っています: ${findings.length}件`);
  process.exit(1);
}

console.log(`公開対象テキストスキャンOK: ${electionId}`);

function readActiveElectionId() {
  const activePath = join(root, 'public', 'data', 'active-election.json');
  return JSON.parse(readFileSync(activePath, 'utf8')).currentId;
}

function scanPath(path) {
  const stats = statSync(path);
  if (stats.isDirectory()) {
    for (const entry of readdirSync(path)) scanPath(join(path, entry));
    return;
  }

  if (!stats.isFile() || !isTextScanTarget(path)) return;

  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [term, pattern] of terms) {
      if (pattern.test(line)) findings.push({ file: relative(root, path), line: index + 1, term });
    }
    for (const [term, pattern] of personalInfoPatterns) {
      if (pattern.test(line)) findings.push({ file: relative(root, path), line: index + 1, term });
    }
  });
}

function isTextScanTarget(path) {
  return ['.json', '.csv', '.md', '.txt'].some((extension) => path.endsWith(extension));
}
