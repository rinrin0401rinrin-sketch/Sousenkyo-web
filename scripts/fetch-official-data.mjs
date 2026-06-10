import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { assertInside, assertSafeElectionId, root, toDisplayPath } from './data-utils.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const manifestPath = readOption('--manifest');
const electionId = readOption('--election') ?? readOption('--election-id');
const outputRoot = resolve(readOption('--output') ?? join(root, 'data', 'imports'));
const defaultMaxBytes = 50 * 1024 * 1024;
const allowedLocalSourceRoots = [resolve(root, 'data', 'source')];

if (!manifestPath) {
  console.error('Usage: node scripts/fetch-official-data.mjs --manifest=<manifest.json> [--election=<electionId>] [--output=<dir>] [--dry-run]');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(resolve(manifestPath), 'utf8'));
const resolvedElectionId = electionId ?? manifest.electionId;
if (!resolvedElectionId) {
  console.error('manifest.electionId または --election が必要です');
  process.exit(1);
}
assertSafeElectionId(resolvedElectionId);

const files = manifest.files ?? [];
if (!Array.isArray(files) || files.length === 0) {
  console.error('manifest.files に取得対象を1件以上指定してください');
  process.exit(1);
}
const urlFiles = files.filter((file) => file.url);
const allowlist = normalizeAllowlist(manifest.allowedHosts ?? manifest.allowlist?.hosts ?? []);
if (urlFiles.length > 0 && allowlist.length === 0) {
  console.error('URL取得には manifest.allowedHosts で公式ドメイン allowlist を指定してください');
  process.exit(1);
}
assertInside(root, outputRoot);

const stamp = timestamp();
const rawDir = resolve(outputRoot, resolvedElectionId, stamp, 'raw');
assertInside(outputRoot, rawDir);

console.log(`Official fetch plan: ${files.length} file(s) -> ${toDisplayPath(rawDir)}`);
if (dryRun) {
  for (const file of files) {
    if (file.url) validateUrlSource(file.url, allowlist);
    if (file.path) {
      const inputPath = resolve(dirname(resolve(manifestPath)), file.path);
      assertAllowedLocalSource(inputPath);
    }
    console.log(`- ${targetName(file)} <= ${file.url ?? file.path}`);
  }
  process.exit(0);
}

mkdirSync(rawDir, { recursive: true });

const receiptFiles = [];
for (const file of files) {
  const name = targetName(file);
  const outputPath = resolve(rawDir, name);
  assertInside(rawDir, outputPath);

  if (file.url) {
    const result = await downloadFile(file, outputPath, allowlist);
    console.log(`Downloaded ${file.url} -> ${toDisplayPath(outputPath)}`);
    receiptFiles.push(result);
  } else if (file.path) {
    const inputPath = resolve(dirname(resolve(manifestPath)), file.path);
    assertAllowedLocalSource(inputPath);
    if (!existsSync(inputPath)) throw new Error(`Missing source file: ${inputPath}`);
    copyFileSync(inputPath, outputPath);
    console.log(`Copied ${toDisplayPath(inputPath)} -> ${toDisplayPath(outputPath)}`);
    receiptFiles.push(localReceipt(file, inputPath, outputPath));
  } else {
    throw new Error(`files[] must include url or path: ${JSON.stringify(file)}`);
  }
}

const receipt = {
  electionId: resolvedElectionId,
  fetchedAt: new Date().toISOString(),
  manifest: toDisplayPath(resolve(manifestPath)),
  rawDir: toDisplayPath(rawDir),
  allowedHosts: allowlist.map((entry) => entry.raw),
  files: receiptFiles,
};
writeFileSync(join(rawDir, 'fetch-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`Receipt written: ${toDisplayPath(join(rawDir, 'fetch-receipt.json'))}`);

function targetName(file) {
  const rawName = file.name ?? basename(file.path ?? new URL(file.url).pathname);
  if (!rawName || rawName === '.' || rawName.includes('/') || rawName.includes('\\')) {
    throw new Error(`Invalid output file name: ${rawName}`);
  }
  return rawName;
}

async function downloadFile(file, outputPath, allowlist) {
  const sourceUrl = validateUrlSource(file.url, allowlist);
  const maxBytes = positiveInteger(file.maxBytes ?? manifest.maxBytes ?? defaultMaxBytes, 'maxBytes');
  let current = sourceUrl;
  const redirects = [];

  const maxRedirects = 3;
  for (let redirectCount = 0; redirectCount < maxRedirects + 1; redirectCount += 1) {
    const response = await fetch(current.href, { redirect: 'manual' });
    if (isRedirect(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Redirect without Location (${response.status}): ${current.href}`);
      const nextUrl = validateUrlSource(new URL(location, current).href, allowlist);
      redirects.push({ status: response.status, from: current.href, to: nextUrl.href });
      current = nextUrl;
      continue;
    }

    if (!response.ok) {
      throw new Error(`Download failed (${response.status}): ${current.href}`);
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > maxBytes) {
      throw new Error(`Download too large (${contentLength} bytes > ${maxBytes} bytes): ${current.href}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new Error(`Download too large (${buffer.byteLength} bytes > ${maxBytes} bytes): ${current.href}`);
    }
    const sha256 = hashBuffer(buffer);
    if (file.sha256 && file.sha256.toLowerCase() !== sha256) {
      throw new Error(`sha256 mismatch for ${current.href}: expected ${file.sha256}, got ${sha256}`);
    }
    writeFileSync(outputPath, buffer);

    return {
      name: targetName(file),
      source: sourceUrl.href,
      finalUrl: current.href,
      output: toDisplayPath(outputPath),
      bytes: buffer.byteLength,
      sha256,
      contentType: response.headers.get('content-type') ?? '',
      etag: response.headers.get('etag') ?? '',
      lastModified: response.headers.get('last-modified') ?? '',
      status: response.status,
      redirects,
    };
  }

  throw new Error(`Too many redirects: ${sourceUrl.href}`);
}

function localReceipt(file, inputPath, outputPath) {
  const buffer = readFileSync(outputPath);
  const stats = statSync(inputPath);
  const sha256 = hashBuffer(buffer);
  if (file.sha256 && file.sha256.toLowerCase() !== sha256) {
    throw new Error(`sha256 mismatch for ${toDisplayPath(inputPath)}: expected ${file.sha256}, got ${sha256}`);
  }

  return {
    name: targetName(file),
    source: toDisplayPath(inputPath),
    output: toDisplayPath(outputPath),
    bytes: buffer.byteLength,
    sha256,
    modifiedAt: stats.mtime.toISOString(),
  };
}

function validateUrlSource(value, allowlist) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid URL: ${value}`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`URL取得は https のみ許可します: ${value}`);
  }
  if (!isAllowedHost(url.hostname, allowlist)) {
    throw new Error(`URL host is not allowed: ${url.hostname}`);
  }
  return url;
}

function assertAllowedLocalSource(inputPath) {
  assertInside(root, inputPath);
  if (!allowedLocalSourceRoots.some((sourceRoot) => inputPath === sourceRoot || inputPath.startsWith(`${sourceRoot}/`))) {
    throw new Error(`Local file source must be inside data/source: ${relative(root, inputPath)}`);
  }
}

function normalizeAllowlist(values) {
  if (!Array.isArray(values)) throw new Error('manifest.allowedHosts は配列で指定してください');
  return values.map((raw) => {
    const value = String(raw ?? '').trim().toLowerCase();
    if (!value || value.includes('/') || value.includes(':')) {
      throw new Error(`Invalid allowed host: ${raw}`);
    }
    return { raw: value, suffix: value.startsWith('.') };
  });
}

function isAllowedHost(hostname, allowlist) {
  const host = hostname.toLowerCase();
  return allowlist.some((entry) => {
    const value = entry.raw.replace(/^\./, '');
    return entry.suffix ? host === value || host.endsWith(`.${value}`) : host === value;
  });
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${label} は正の整数で指定してください`);
  }
  return number;
}

function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function isRedirect(status) {
  return [301, 302, 303, 307, 308].includes(status);
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
