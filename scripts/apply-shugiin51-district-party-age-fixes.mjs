import fs from "node:fs";
import path from "node:path";

const defaultReviewRoot = "data/work/shugiin-51st-glossary-review";
const args = process.argv.slice(2);
const reviewRoot = readOption("--review-root") ?? defaultReviewRoot;
const dryRun = args.includes("--dry-run");

const candidatesPath = path.join(reviewRoot, "candidates.csv");
const nameReportPath = path.join(reviewRoot, "name-reading-report.csv");
const fixesPath = path.join(reviewRoot, "manual-fix", "manual-district-party-age-fix-candidates.csv");
const reportPath = path.join(
  reviewRoot,
  "manual-fix",
  dryRun ? "manual-district-party-age-apply-dry-run.csv" : "manual-district-party-age-apply-report.csv",
);

const candidates = readCsv(candidatesPath);
const nameReports = readCsv(nameReportPath);
const fixes = readCsv(fixesPath);
const fixById = new Map(fixes.map((row) => [row.id, row]));
const reportRows = [];

for (const row of candidates) {
  const fix = fixById.get(row.id);
  if (!fix) continue;

  const before = {
    age: row.age,
    partyLabel: row.partyLabel,
    statusLabel: row.statusLabel,
    wins: row.wins,
    districtLabel: row.districtLabel,
  };

  row.age = fix.correct_age;
  row.partyLabel = fix.correct_party;
  row.statusLabel = fix.correct_status;
  row.wins = fix.correct_wins;
  row.districtLabel = fix.correct_district || row.districtLabel;
  row.seatType = row.districtLabel.startsWith("比") ? "比例" : "小選挙区";
  row.description = rebuildDescription(row);

  reportRows.push({
    id: row.id,
    label: row.label,
    beforeAge: before.age,
    afterAge: row.age,
    beforeParty: before.partyLabel,
    afterParty: row.partyLabel,
    beforeStatus: before.statusLabel,
    afterStatus: row.statusLabel,
    beforeWins: before.wins,
    afterWins: row.wins,
    beforeDistrict: before.districtLabel,
    afterDistrict: row.districtLabel,
    evidencePage: fix.evidence_page,
    confidence: fix.confidence,
    applied: dryRun ? "dry-run" : "yes",
  });
}

if (!dryRun) {
  writeCsv(candidatesPath, candidates);
  const reportById = new Map(nameReports.map((row) => [row.id, row]));
  for (const fix of fixes) {
    const row = reportById.get(fix.id);
    if (!row) continue;
    row.age = fix.correct_age;
    row.partyLabel = fix.correct_party;
    row.statusLabel = fix.correct_status;
    row.wins = fix.correct_wins;
    row.districtLabel = fix.correct_district || row.districtLabel;
  }
  writeCsv(nameReportPath, nameReports);
}

writeCsv(reportPath, reportRows);

console.log(`${dryRun ? "Dry-run checked" : "Applied"} ${reportRows.length} district/party/age fix(es)`);
console.log(`- ${reportPath}`);

function rebuildDescription(row) {
  const pieces = [
    row.districtLabel,
    row.partyLabel,
    row.statusLabel,
    row.wins ? `当選${row.wins}回` : "",
    row.age ? `${row.age}歳` : "",
  ].filter(Boolean);
  return pieces.join(" / ");
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
