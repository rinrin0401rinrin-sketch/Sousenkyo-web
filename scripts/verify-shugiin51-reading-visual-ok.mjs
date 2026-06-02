import fs from "node:fs";
import path from "node:path";

const defaultReviewRoot = "data/work/shugiin-51st-glossary-review";
const args = process.argv.slice(2);
const reviewRoot = readOption("--review-root") ?? defaultReviewRoot;
const dryRun = args.includes("--dry-run");
const allowEmpty = args.includes("--allow-empty");
const allowDecrease = args.includes("--allow-decrease");
const manualFixDir = path.join(reviewRoot, "manual-fix");
let sourcePath = readOption("--input") ?? path.join(manualFixDir, "manual-reading-visual-ok.csv");
const candidatesPath = path.join(manualFixDir, "reading-verified-candidates.csv");
const sourceSnapshotPath = path.join(manualFixDir, "reading-verified-source-snapshot.csv");
const reportPath = path.join(
  manualFixDir,
  dryRun ? "reading-verified-apply-dry-run.csv" : "reading-verified-apply-report.csv",
);

let sourceRows = readCsv(sourcePath);
let replayedSnapshot = false;
if (sourceRows.length === 0 && !allowEmpty && fs.existsSync(sourceSnapshotPath) && sourcePath !== sourceSnapshotPath) {
  sourcePath = sourceSnapshotPath;
  sourceRows = readCsv(sourcePath);
  replayedSnapshot = true;
}
const existingVerifiedRows = fs.existsSync(candidatesPath) ? readCsv(candidatesPath) : [];
if (sourceRows.length === 0 && !allowEmpty) {
  fail([
    `Refusing to verify 0 reading visual-ok row(s) from ${sourcePath}.`,
    "This protects reading-verified-candidates.csv from being overwritten after QA has already moved rows out of manual-reading-visual-ok.csv.",
    "Use --input data/work/.../manual-fix/reading-verified-source-snapshot.csv to replay the original input, or pass --allow-empty only when intentionally clearing the ledger.",
  ]);
}
if (!dryRun && existingVerifiedRows.length > sourceRows.length && !allowDecrease) {
  fail([
    `Refusing to shrink reading-verified-candidates.csv from ${existingVerifiedRows.length} to ${sourceRows.length} row(s).`,
    "Pass --allow-decrease only after confirming the smaller input is intentional.",
  ]);
}

const verifiedRows = sourceRows.map((row) => ({
  id: row.id,
  label: row.label,
  verified_reading: normalizeReading(row.reading),
  evidence: "manual-reading-visual-ok.csv",
  confidence: "visual-ok",
  note: row.readingReviewReason || "QA上の読み確認でvisual-okに分類済み。",
}));

fs.mkdirSync(manualFixDir, { recursive: true });
writeCsv(reportPath, verifiedRows.map((row) => ({
  ...row,
  applied: dryRun ? "dry-run" : "yes",
})));

if (!dryRun) {
  writeCsv(sourceSnapshotPath, sourceRows);
  writeCsv(candidatesPath, verifiedRows);
}

console.log(`${dryRun ? "Dry-run checked" : "Verified"} ${verifiedRows.length} reading visual-ok row(s)`);
console.log(`- ${reportPath}`);
if (replayedSnapshot) {
  console.log(`- replayed source snapshot: ${sourceSnapshotPath}`);
}
if (!dryRun) {
  console.log(`- ${sourceSnapshotPath}`);
  console.log(`- ${candidatesPath}`);
}

function fail(lines) {
  for (const line of lines) {
    console.error(line);
  }
  process.exit(1);
}

function normalizeReading(value) {
  return String(value || "").replace(/\s+/g, "");
}

function readOption(name) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(text);
  const headers = rows.shift() ?? [];
  return rows
    .filter((row) => row.length > 0)
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function writeCsv(filePath, rows) {
  if (rows.length === 0) {
    fs.writeFileSync(filePath, "", "utf8");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header] ?? "")).join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function escapeCsv(value) {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}
