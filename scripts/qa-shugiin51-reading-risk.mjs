import fs from "node:fs";
import path from "node:path";

const defaultCandidatesPath = "data/source/glossary/csv/candidates.csv";
const defaultReviewRoot = "data/work/shugiin-51st-glossary-review";
const defaultOutPath = path.join(defaultReviewRoot, "manual-fix", "reading-risk-report.csv");
const defaultVerifiedFixesPath = "scripts/shugiin51-card-risk-fixes.csv";

const args = process.argv.slice(2);
const candidatesPath = readOption("--candidates") ?? defaultCandidatesPath;
const extractReportPath = readOption("--extract-report") ?? path.join(defaultReviewRoot, "extract-report.csv");
const outPath = readOption("--out") ?? defaultOutPath;
const verifiedFixesPath = readOption("--verified-fixes") ?? defaultVerifiedFixesPath;

const pastRiskReasons = new Set([
  "district-missing",
  "label-suspicious",
  "reading-suspicious",
]);

const knownBadReadings = new Map([
  ["candidate-040", { expected: "いずみ けんた", note: "下の名前の末尾が欠けた既知誤読です。" }],
  ["candidate-098", { expected: "おだわら きよし", note: "姓・名の順序崩れと混入由来の既知誤読です。" }],
]);

const candidates = readCsv(candidatesPath).filter((row) => row.category === "candidate");
const extractReports = fs.existsSync(extractReportPath) ? readCsv(extractReportPath) : [];
const extractById = new Map(extractReports.map((row) => [row.id, row]));
const verifiedFixes = fs.existsSync(verifiedFixesPath) ? readCsv(verifiedFixesPath) : [];
const verifiedFixById = new Map(verifiedFixes.map((row) => [row.id, row]));

const riskRows = [];

for (const row of candidates) {
  const extractReport = extractById.get(row.id) ?? {};
  const extractReasons = normalizeReasons(extractReport.notes);
  const verifiedFix = verifiedFixById.get(row.id);
  const risks = classifyReadingRisk(row, extractReport, extractReasons, verifiedFix);
  if (risks.length === 0) continue;

  riskRows.push({
    id: row.id,
    label: row.label,
    reading: row.reading,
    reviewStatus: row.reviewStatus,
    districtLabel: row.districtLabel,
    partyLabel: row.partyLabel,
    extractLabel: extractReport.label || "",
    extractReason: extractReasons.join("|"),
    riskReason: risks.map((risk) => risk.reason).join("|"),
    fixHint: risks.map((risk) => risk.fixHint).join(" / "),
  });
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
writeCsv(outPath, riskRows, [
  "id",
  "label",
  "reading",
  "reviewStatus",
  "districtLabel",
  "partyLabel",
  "extractLabel",
  "extractReason",
  "riskReason",
  "fixHint",
]);

console.log(`Reading risk QA written to ${outPath}`);
console.log(`- candidates scanned: ${candidates.length}`);
console.log(`- risk rows: ${riskRows.length}`);

function classifyReadingRisk(row, extractReport, extractReasons, verifiedFix) {
  const risks = [];
  const label = row.label || "";
  const reading = row.reading || "";
  const normalizedReading = normalizeReading(reading);
  const labelLength = countJapaneseNameChars(label);
  const knownBad = knownBadReadings.get(row.id);
  const isVerifiedFixed = hasMatchingVerifiedFix(row, verifiedFix);

  if (knownBad && normalizeReading(knownBad.expected) !== normalizedReading) {
    risks.push({
      reason: "known-bad-reading",
      fixHint: `${knownBad.note} 想定読み: ${knownBad.expected}`,
    });
  }

  if (!normalizedReading) {
    risks.push({
      reason: "reading-empty",
      fixHint: "読みが空欄です。PDFまたは公式情報で確認してください。",
    });
  } else if (labelLength > 0 && normalizedReading.length <= Math.max(3, labelLength)) {
    risks.push({
      reason: "reading-too-short",
      fixHint: "読みが氏名の文字数に対して短く、名の末尾欠けや姓だけの可能性があります。",
    });
  } else if (labelLength > 0 && normalizedReading.length >= Math.max(14, labelLength * 5)) {
    risks.push({
      reason: "reading-too-long",
      fixHint: "読みが長く、別候補や肩書きの混入がないか確認してください。",
    });
  }

  const matchedPastReasons = extractReasons.filter((reason) => pastRiskReasons.has(reason));
  if (!isVerifiedFixed && matchedPastReasons.length > 0) {
    risks.push({
      reason: `past-extract-risk:${matchedPastReasons.join("+")}`,
      fixHint: "過去の抽出レポートで読み崩れに繋がるリスクが付いていました。reviewStatus=okでも読みを再確認してください。",
    });
  }

  const mixedPattern = isVerifiedFixed ? "" : findKnownMixedPattern(row, extractReport);
  if (mixedPattern) {
    risks.push({
      reason: `known-mixed-pattern:${mixedPattern}`,
      fixHint: "抽出時の氏名欄に区分・地域・肩書きなどの混入パターンがあります。",
    });
  }

  return uniqueRisks(risks);
}

function hasMatchingVerifiedFix(row, fix) {
  if (!fix) return false;
  return (
    normalizeComparable(row.label) === normalizeComparable(fix.correct_label) &&
    normalizeReading(row.reading) === normalizeReading(fix.correct_reading) &&
    normalizeComparable(row.districtLabel) === normalizeComparable(fix.correct_district)
  );
}

function normalizeComparable(value) {
  return String(value || "").replace(/\s+/g, "");
}

function findKnownMixedPattern(row, extractReport) {
  const label = row.label || "";
  const extractLabel = extractReport.label || "";
  const reading = normalizeReading(row.reading);
  if (/比(?:北海道|東北|北関東|南関東|東京|北信越|東海|近畿|中国|四国|九州)/.test(extractLabel)) {
    return "proportional-block-token";
  }
  if (label && extractLabel && extractLabel !== label && extractLabel.includes(label)) {
    return "extract-label-contained-current-name";
  }
  if (/^(区|比|道|県|院|防衛|原子力|菱商事)/.test(label)) {
    return "layout-token-prefix";
  }
  if (/(米|京|横浜|日本航空|創価大|川上野|木汀)/.test(label) && label.length >= 5) {
    return "career-or-place-token";
  }
  if (/([ぁ-ん]{3,})\1/.test(reading)) {
    return "repeated-reading";
  }
  return "";
}

function countJapaneseNameChars(value) {
  return String(value || "").replace(/[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, "").length;
}

function normalizeReading(value) {
  return String(value || "").replace(/\s+/g, "");
}

function normalizeReasons(value) {
  return unique(String(value || "")
    .split(/[|;]/)
    .map((part) => part.trim())
    .filter(Boolean));
}

function unique(values) {
  return [...new Set(values)];
}

function uniqueRisks(risks) {
  const seen = new Set();
  return risks.filter((risk) => {
    if (seen.has(risk.reason)) return false;
    seen.add(risk.reason);
    return true;
  });
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
  return rows.filter((row) => row.length > 0).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
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

function writeCsv(filePath, rows, headers) {
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
