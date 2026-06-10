import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extname, join, relative, sep } from 'node:path';

const root = process.cwd();
const targets = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const scanTargets = targets.length > 0 ? targets : gitVisibleFiles();
const skippedDirectories = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.vite']);
const skippedExtensions = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.heic',
  '.ico',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.tiff',
  '.webp',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.zip',
]);

const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['OpenAI API key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['secret assignment', /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|secret|private[_-]?key)\b\s*[:=]\s*["']?(?!YOUR_|REPLACE_|EXAMPLE|example|dummy|DUMMY|TODO|todo|未設定)[A-Za-z0-9_./+=:-]{12,}/i],
];

const findings = [];

for (const target of scanTargets) {
  const fullPath = join(root, target);
  if (!existsSync(fullPath)) continue;
  scanPath(fullPath);
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`ERROR ${finding.file}:${finding.line}: ${finding.label}`);
  }
  console.error(`\n秘密情報らしき文字列を検出しました: ${findings.length}件`);
  process.exit(1);
}

console.log(`秘密情報スキャンOK: ${scanTargets.length} file(s)/target(s)`);

function scanPath(path) {
  const stats = statSync(path);
  if (stats.isDirectory()) {
    if (skippedDirectories.has(path.split(sep).pop())) return;
    for (const entry of readdirSync(path)) scanPath(join(path, entry));
    return;
  }

  if (!stats.isFile() || shouldSkipFile(path)) return;

  const buffer = readFileSync(path);
  if (isProbablyBinary(buffer)) return;

  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [label, pattern] of patterns) {
      if (pattern.test(line)) {
        findings.push({ file: relative(root, path), line: index + 1, label });
      }
    }
  });
}

function shouldSkipFile(path) {
  const lowerPath = path.toLowerCase();
  const relativePath = relative(root, path);
  if (relativePath.split(sep).some((part) => skippedDirectories.has(part))) return true;
  return skippedExtensions.has(extname(lowerPath));
}

function gitVisibleFiles() {
  return [...gitFiles(['ls-files', '-z']), ...gitFiles(['ls-files', '--others', '--exclude-standard', '-z'])];
}

function gitFiles(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim() || `exit ${result.status}`}`);
  }
  return result.stdout.split('\0').filter(Boolean);
}

function isProbablyBinary(buffer) {
  return buffer.includes(0);
}
