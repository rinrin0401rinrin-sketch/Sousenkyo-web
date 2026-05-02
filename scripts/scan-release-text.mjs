import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const electionId = args.find((arg) => !arg.startsWith('--')) ?? readActiveElectionId();
const dataDir = join(root, 'public', 'data', electionId);
const terms = [
  ['TODO', /\bTODO\b/i],
  ['FIXME', /\bFIXME\b/i],
  ['sample', /\bsample\b/i],
  ['dummy', /\bdummy\b/i],
  ['サンプル', /サンプル/],
  ['ダミー', /ダミー/],
];

if (!existsSync(dataDir)) {
  console.error(`public/data/${electionId} がありません`);
  process.exit(1);
}

const findings = [];
scanPath(dataDir);

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

  if (!stats.isFile() || !path.endsWith('.json')) return;

  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [term, pattern] of terms) {
      if (pattern.test(line)) findings.push({ file: relative(root, path), line: index + 1, term });
    }
  });
}
