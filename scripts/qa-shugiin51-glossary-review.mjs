import fs from "node:fs";
import path from "node:path";

const defaultReviewRoot = "data/work/shugiin-51st-glossary-review";

const args = process.argv.slice(2);
const reviewRoot = readOption("--review-root") ?? defaultReviewRoot;
const outDir = readOption("--out") ?? path.join(reviewRoot, "manual-fix");

const candidatesPath = path.join(reviewRoot, "candidates.csv");
const nameReportPath = path.join(reviewRoot, "name-reading-report.csv");
const photoDir = path.join(reviewRoot, "photos");
const verifiedFullNamesPath = path.join(outDir, "fullname-verified-candidates.csv");
const verifiedReadingsPath = path.join(outDir, "reading-verified-candidates.csv");

const candidates = readCsv(candidatesPath);
const nameReports = readCsv(nameReportPath);
const reportById = new Map(nameReports.map((row) => [row.id, row]));
const verifiedFullNames = loadVerifiedFullNames(verifiedFullNamesPath);
const verifiedReadings = loadVerifiedReadings(verifiedReadingsPath);

fs.mkdirSync(outDir, { recursive: true });

const manualRows = [];
const safeRows = [];
const photoRows = [];
const nameSuspectRows = [];
const manualRealNeededRows = [];
const manualQaReasonOnlyRows = [];
const manualHighIdentityRows = [];
const manualReadingOnlyRows = [];
const manualDistrictPartyAgeRows = [];
const manualDistrictPartyAgeRealNeededRows = [];
const manualDistrictPartyAgeQaReasonOnlyRows = [];
const manualLowBulkRows = [];
const manualReadingTooShortRows = [];
const manualReadingMixedSuspectRows = [];
const manualReadingVisualOkRows = [];
const reasonCounts = new Map();

for (const row of candidates) {
  const report = reportById.get(row.id) ?? {};
  const reasons = normalizeReadingReasons(row, normalizeReasons(report.reason || row.reviewStatus || ""), verifiedReadings);
  for (const reason of reasons) {
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }

  const action = classifyCandidate(row, reasons);
  const photo = inspectPhoto(path.join(photoDir, path.basename(row.photoUrl || "")));
  photoRows.push({
    id: row.id,
    label: row.label,
    photoFile: path.basename(row.photoUrl || ""),
    exists: photo.exists ? "yes" : "no",
    width: photo.width || "",
    height: photo.height || "",
    fileSizeBytes: photo.fileSizeBytes || "",
    photoQa: photo.qa,
  });
  const nameSuspect = classifyFullName(row, reasons, verifiedFullNames);
  if (nameSuspect.priority !== "none") {
    nameSuspectRows.push({
      id: row.id,
      label: row.label,
      reading: row.reading,
      districtLabel: row.districtLabel,
      partyLabel: row.partyLabel,
      reviewStatus: row.reviewStatus,
      priority: nameSuspect.priority,
      nameQaReason: nameSuspect.reasons.join("|"),
      fixHint: nameSuspect.fixHint,
    });
  }

  const output = {
    id: row.id,
    label: row.label,
    reading: row.reading,
    age: row.age,
    partyLabel: row.partyLabel,
    statusLabel: row.statusLabel,
    wins: row.wins,
    districtLabel: row.districtLabel,
    photoUrl: row.photoUrl,
    reviewStatus: row.reviewStatus,
    reason: reasons.join("|"),
    action: action.action,
    fixHint: action.fixHint,
  };

  if (action.action === "manual-review") {
    const manualBucket = classifyManualReview(output, reasons, verifiedFullNames);
    output.reviewBucket = manualBucket.bucket;
    output.reviewReason = manualBucket.reason;
    manualRows.push(output);
    if (manualBucket.needsHuman) {
      manualRealNeededRows.push(output);
    } else {
      manualQaReasonOnlyRows.push(output);
    }

    if (manualBucket.detailBucket === "manual-high-identity") {
      manualHighIdentityRows.push(output);
    } else if (manualBucket.detailBucket === "manual-reading-only") {
      const readingBucket = classifyReadingReview(output, reasons);
      output.readingBucket = readingBucket.bucket;
      output.readingReviewReason = readingBucket.reason;
      manualReadingOnlyRows.push(output);
      if (readingBucket.bucket === "too-short") {
        manualReadingTooShortRows.push(output);
      } else if (readingBucket.bucket === "mixed-suspect") {
        manualReadingMixedSuspectRows.push(output);
      } else {
        manualReadingVisualOkRows.push(output);
      }
    } else if (manualBucket.detailBucket === "manual-district-party-age") {
      const districtPartyAgeBucket = classifyDistrictPartyAgeReview(output);
      output.districtPartyAgeBucket = districtPartyAgeBucket.bucket;
      output.districtPartyAgeReviewReason = districtPartyAgeBucket.reason;
      manualDistrictPartyAgeRows.push(output);
      if (districtPartyAgeBucket.bucket === "real-needed") {
        manualDistrictPartyAgeRealNeededRows.push(output);
      } else {
        manualDistrictPartyAgeQaReasonOnlyRows.push(output);
      }
    } else {
      manualLowBulkRows.push(output);
    }
  } else {
    safeRows.push(output);
  }
}

writeCsv(path.join(outDir, "candidates-ng-only.csv"), manualRows);
writeCsv(path.join(outDir, "candidates-safe-auto.csv"), safeRows);
writeCsv(path.join(outDir, "manual-review-real-needed.csv"), manualRealNeededRows);
writeCsv(path.join(outDir, "manual-review-qa-reason-only.csv"), manualQaReasonOnlyRows);
writeCsv(path.join(outDir, "manual-high-identity.csv"), manualHighIdentityRows);
writeCsv(path.join(outDir, "manual-reading-only.csv"), manualReadingOnlyRows);
writeCsv(path.join(outDir, "manual-reading-too-short.csv"), manualReadingTooShortRows);
writeCsv(path.join(outDir, "manual-reading-mixed-suspect.csv"), manualReadingMixedSuspectRows);
writeCsv(path.join(outDir, "manual-reading-visual-ok.csv"), manualReadingVisualOkRows);
writeCsv(path.join(outDir, "manual-district-party-age.csv"), manualDistrictPartyAgeRows);
writeCsv(path.join(outDir, "manual-district-party-age-real-needed.csv"), manualDistrictPartyAgeRealNeededRows);
writeCsv(path.join(outDir, "manual-district-party-age-qa-reason-only.csv"), manualDistrictPartyAgeQaReasonOnlyRows);
writeCsv(path.join(outDir, "manual-low-bulk-check.csv"), manualLowBulkRows);
writeCsv(path.join(outDir, "name-fullname-suspects.csv"), nameSuspectRows);
writeCsv(path.join(outDir, "photo-qa-report.csv"), photoRows);
writeText(path.join(outDir, "qa-summary.md"), renderSummary({
  candidates,
  manualRows,
  safeRows,
  manualRealNeededRows,
  manualQaReasonOnlyRows,
  manualHighIdentityRows,
  manualReadingOnlyRows,
  manualReadingTooShortRows,
  manualReadingMixedSuspectRows,
  manualReadingVisualOkRows,
  manualDistrictPartyAgeRows,
  manualDistrictPartyAgeRealNeededRows,
  manualDistrictPartyAgeQaReasonOnlyRows,
  manualLowBulkRows,
  nameSuspectRows,
  photoRows,
  reasonCounts,
  verifiedReadingCount: verifiedReadings.size,
  readingMissingCount: candidates.filter((row) => !row.reading).length,
  districtPendingCount: candidates.filter((row) => row.districtLabel === "区分確認中").length,
}));

console.log(`Review QA written to ${outDir}`);
console.log(`- candidates-ng-only.csv: ${manualRows.length} row(s)`);
console.log(`- candidates-safe-auto.csv: ${safeRows.length} row(s)`);
console.log(`- manual-review-real-needed.csv: ${manualRealNeededRows.length} row(s)`);
console.log(`- manual-review-qa-reason-only.csv: ${manualQaReasonOnlyRows.length} row(s)`);
console.log(`- name-fullname-suspects.csv: ${nameSuspectRows.length} row(s)`);
console.log(`- photo-qa-report.csv: ${photoRows.length} row(s)`);

function classifyCandidate(row, reasons) {
  const fixHints = [];
  const label = row.label || "";
  const reading = row.reading || "";
  const district = row.districtLabel || "";
  const age = row.age || "";
  const party = row.partyLabel || "";

  const hardNg = new Set([
    "text-match-missing",
    "label-suspicious",
    "reading-suspicious",
    "district-missing",
    "age-missing",
    "party-missing",
  ]);

  if (!label) fixHints.push("氏名が空欄です。PDFの該当slotから氏名を確認してください。");
  if (!reading) fixHints.push("ふりがなが空欄です。氏名のルビを確認してください。");
  if (!age) fixHints.push("年齢が空欄です。");
  if (!party) fixHints.push("政党が空欄です。");
  if (!district || district === "区分確認中") fixHints.push("選挙区/比例区分を確認してください。");
  if (/^(区|比|道|県|院|防衛|原子力|菱商事)/.test(label)) {
    fixHints.push("氏名に見出し・前候補の文字が混入している疑いがあります。");
  }
  if (label.length < 3) {
    fixHints.push("氏名が短すぎる可能性があります。2文字氏名の場合も念のため確認してください。");
  }
  if (reading.length > 0 && reading.length < 4) {
    fixHints.push("ふりがなが短すぎる可能性があります。");
  }
  if (reasons.some((reason) => hardNg.has(reason))) {
    fixHints.push("抽出レポートでNG理由が付いています。");
  }

  if (fixHints.length > 0) {
    return { action: "manual-review", fixHint: unique(fixHints).join(" / ") };
  }
  return { action: "safe-auto", fixHint: "機械QAでは大きなNGなし。最終公開前に抜き取り確認してください。" };
}

function classifyFullName(row, reasons, verifiedFullNames) {
  if (row.reviewStatus === "ok" || verifiedFullNames.has(row.id)) {
    return { priority: "none", reasons: [], fixHint: "" };
  }

  const label = row.label || "";
  const reading = row.reading || "";
  const qaReasons = [];
  const hardTokens = [
    "防衛",
    "原子力",
    "菱商事",
    "財務",
    "地方創生",
    "総研",
    "研究",
    "委員",
    "特別",
    "副大",
    "政調",
    "拉致",
    "投資銀行",
    "米大院",
    "東大法",
    "東大公",
    "国学院大",
    "栄養専門学",
    "衆院議員秘",
    "大福岡短大",
    "創価学",
    "議員秘",
    "法務政",
  ];

  if (/^候補者\d+$/.test(label)) qaReasons.push("placeholder-name");
  if (label.length <= 2) qaReasons.push("too-short-name");
  if (/^[区比]/.test(label)) qaReasons.push("layout-token-prefix");
  if (/[・]/.test(label)) qaReasons.push("symbol-mixed");
  if (hardTokens.some((token) => label.includes(token))) qaReasons.push("career-or-heading-mixed");
  if (label.length > 8) qaReasons.push("too-long-name");
  if (!reading) qaReasons.push("reading-empty");
  if (reasons.includes("label-suspicious")) qaReasons.push("source-label-was-suspicious");
  if (reasons.includes("text-match-missing")) qaReasons.push("source-text-match-missing");

  if (qaReasons.length === 0) {
    return { priority: "none", reasons: [], fixHint: "" };
  }

  const highReasons = new Set([
    "placeholder-name",
    "too-short-name",
    "layout-token-prefix",
    "symbol-mixed",
    "career-or-heading-mixed",
    "too-long-name",
  ]);
  const priority = qaReasons.some((reason) => highReasons.has(reason)) ? "High" : "Medium";
  const fixHint = priority === "High"
    ? "漢字氏名がフルネームでない可能性が高いです。PDF画像の該当slotで氏名を確認してください。"
    : "氏名は自然に見えますが、読み空欄など周辺項目のズレがあります。公開前に確認してください。";
  return { priority, reasons: unique(qaReasons), fixHint };
}

function classifyManualReview(row, reasons, verifiedFullNames) {
  const reasonSet = new Set(reasons);
  const reading = row.reading || "";
  const invalidDistrict = !isDistrictLike(row.districtLabel || "");
  const missingMajor = [
    row.label,
    row.reading,
    row.age,
    row.partyLabel,
    row.statusLabel,
    row.wins,
    row.districtLabel,
  ].some((value) => !value);
  const shortReading = reading.length > 0 && reading.length < 4;
  const verifiedName = verifiedFullNames.has(row.id);
  const identityReason = !verifiedName && (
    reasonSet.has("label-suspicious")
    || reasonSet.has("text-match-missing")
    || isLabelVisiblySuspicious(row.label || "")
  );
  const readingReason = shortReading || reasonSet.has("auto-parse") || reasonSet.has("reading-suspicious");
  const districtPartyAgeReason = invalidDistrict || missingMajor || reasonSet.has("district-missing") || reasonSet.has("party-missing") || reasonSet.has("age-missing");
  const needsHuman = identityReason || readingReason || invalidDistrict || missingMajor || reasonSet.has("auto-parse");

  if (identityReason) {
    return {
      bucket: "real-needed",
      detailBucket: "manual-high-identity",
      needsHuman: true,
      reason: "氏名混入・氏名照合リスクが残っています。",
    };
  }
  if (readingReason) {
    return {
      bucket: "real-needed",
      detailBucket: "manual-reading-only",
      needsHuman: true,
      reason: "ふりがな確認が必要です。",
    };
  }
  if (districtPartyAgeReason) {
    return {
      bucket: needsHuman ? "real-needed" : "qa-reason-only",
      detailBucket: "manual-district-party-age",
      needsHuman,
      reason: needsHuman ? "主要項目の欠損または形式確認が必要です。" : "補正済み項目に過去QA理由だけ残っています。",
    };
  }
  return {
    bucket: "qa-reason-only",
    detailBucket: "manual-low-bulk-check",
    needsHuman: false,
    reason: "主要項目は埋まっており、過去QA理由だけ残っています。",
  };
}

function classifyReadingReview(row, reasons) {
  const reading = row.reading || "";
  const label = row.label || "";
  const reasonSet = new Set(reasons);
  if (reading.length > 0 && reading.length < 4) {
    return {
      bucket: "too-short",
      reason: "ふりがなが短く、下の名前または姓だけになっている可能性があります。",
    };
  }
  if (reasonSet.has("auto-parse")) {
    return {
      bucket: "too-short",
      reason: "自動抽出由来で短い読みとして検出されています。",
    };
  }
  if (isReadingMixedSuspect(label, reading)) {
    return {
      bucket: "mixed-suspect",
      reason: "氏名または読みが別候補・肩書きと混ざっている可能性があります。",
    };
  }
  return {
    bucket: "visual-ok",
    reason: "見た目上は読みとして自然です。公開前の抜き取り確認に回せます。",
  };
}

function classifyDistrictPartyAgeReview(row) {
  const problems = [];
  if (!row.age) {
    problems.push("年齢が空欄です。");
  } else if (!/^\d+$/.test(row.age)) {
    problems.push("年齢が数値形式ではありません。");
  }
  if (!row.partyLabel) {
    problems.push("政党が空欄です。");
  }
  if (!row.statusLabel) {
    problems.push("新前元が空欄です。");
  }
  if (!row.wins) {
    problems.push("当選回数が空欄です。");
  } else if (!/^\d+$/.test(row.wins)) {
    problems.push("当選回数が数値形式ではありません。");
  }
  if (!isDistrictLike(row.districtLabel || "")) {
    problems.push("選挙区/比例区分が未確定または形式外です。");
  }

  if (problems.length > 0) {
    return {
      bucket: "real-needed",
      reason: problems.join(" / "),
    };
  }
  return {
    bucket: "qa-reason-only",
    reason: "年齢・政党・新前元・当選回数・選挙区は埋まっており、過去QA理由だけ残っています。",
  };
}

function isReadingMixedSuspect(label, reading) {
  if (label === "日野紗里亜" && reading === "ひのさりあ") return false;
  if (isKnownExtractionArtifact(label)) return true;
  if (/(米|京|横浜|日本航空|創価大|新|日|宇|川上野|木汀)/.test(label) && label.length >= 5) return true;
  if (reading.length >= 14) return true;
  if (/([ぁ-ん]{3,})\1/.test(reading)) return true;
  return [
    "なかがわたかもとなかがわひろ",
    "やすおかひろたけやなかずお",
    "むらかみとものぶむらき",
  ].includes(reading);
}

function isDistrictLike(value) {
  if (!value || value === "区分確認中") return false;
  if (/^比(北海道|東北|北関東|南関東|東京|北信越|東海|近畿|中国|四国|九州)$/.test(value)) return true;
  return /^[一-龥ぁ-んァ-ン]+(?:都|道|府|県)?\d+区$/.test(value);
}

function isLabelVisiblySuspicious(label) {
  if (!label) return true;
  if (/^候補者\d+$/.test(label)) return true;
  if (label.length <= 2 || label.length > 8) return true;
  if (/^[区比]/.test(label)) return true;
  if (/比(?:北海道|東北|北関東|南関東|東京|北信越|東海|近畿|中国|四国|九州)/.test(label)) return true;
  if (/[・]/.test(label)) return true;
  if (isKnownExtractionArtifact(label)) return true;
  return [
    "防衛",
    "原子力",
    "菱商事",
    "財務",
    "地方創生",
    "総研",
    "研究",
    "委員",
    "特別",
    "副大",
    "政調",
    "拉致",
    "投資銀行",
    "米大院",
    "東大法",
    "東大公",
    "国学院大",
    "栄養専門学",
    "衆院議員秘",
    "大福岡短大",
    "創価学",
    "議員秘",
    "法務政",
  ].some((token) => label.includes(token));
}

function isKnownExtractionArtifact(label) {
  return [
    /^北伊藤/,
    /^専井上/,
    /^富岩屋/,
    /^米大島/,
    /^明鬼木/,
    /^早神谷/,
    /^外菅家/,
    /^青山学古賀/,
    /^千葉許斐/,
    /^東小林/,
    /^名古屋音関/,
    /^宮城将明/,
    /^早大院高見/,
    /^科技田中/,
    /^泉佐野谷/,
    /^文寺田/,
    /^川宏昌/,
    /^参長妻/,
    /^北信越西村/,
    /^東野中/,
    /^横浜橋本/,
    /^教育大浜田/,
    /^東平口/,
    /^埼玉県知事平林/,
    /^大館福田/,
    /^東船田/,
    /^慶美延/,
    /^東武藤/,
    /^名古屋森/,
    /^慶山本/,
    /^岩見沢渡辺/,
  ].some((pattern) => pattern.test(label));
}

function inspectPhoto(photoPath) {
  if (!photoPath || !fs.existsSync(photoPath)) {
    return { exists: false, qa: "missing-photo" };
  }
  const stat = fs.statSync(photoPath);
  const info = readPngDimensions(photoPath);
  const problems = [];
  if (!info) problems.push("not-png");
  if (info && (info.width !== 270 || info.height !== 360)) {
    problems.push(`unexpected-size:${info.width}x${info.height}`);
  }
  if (stat.size < 8_000) problems.push("too-small-file");
  return {
    exists: true,
    width: info?.width,
    height: info?.height,
    fileSizeBytes: stat.size,
    qa: problems.length ? problems.join("|") : "ok",
  };
}

function readPngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function renderSummary({
  candidates,
  manualRows,
  safeRows,
  manualRealNeededRows,
  manualQaReasonOnlyRows,
  manualHighIdentityRows,
  manualReadingOnlyRows,
  manualReadingTooShortRows,
  manualReadingMixedSuspectRows,
  manualReadingVisualOkRows,
  manualDistrictPartyAgeRows,
  manualDistrictPartyAgeRealNeededRows,
  manualDistrictPartyAgeQaReasonOnlyRows,
  manualLowBulkRows,
  nameSuspectRows,
  photoRows,
  reasonCounts,
  verifiedReadingCount,
  readingMissingCount,
  districtPendingCount,
}) {
  const photoProblems = photoRows.filter((row) => row.photoQa !== "ok");
  const namePriorities = nameSuspectRows.reduce((acc, row) => {
    acc.set(row.priority, (acc.get(row.priority) ?? 0) + 1);
    return acc;
  }, new Map());
  const namePriorityLines = [...namePriorities.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([priority, count]) => `- ${priority}: ${count}`)
    .join("\n");
  const reasonLines = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, count]) => `- ${reason}: ${count}`)
    .join("\n");

  return `# 第51回 単語カードレビューQA

## Summary
- Total candidates: ${candidates.length}
- Manual review rows: ${manualRows.length}
- Manual real-needed rows: ${manualRealNeededRows.length}
- Manual QA-reason-only rows: ${manualQaReasonOnlyRows.length}
- Safe auto rows: ${safeRows.length}
- Full-name suspect rows: ${nameSuspectRows.length}
- Verified reading rows: ${verifiedReadingCount}
- Photo QA rows: ${photoRows.length}
- Photo problems: ${photoProblems.length}
- Missing readings: ${readingMissingCount}
- Pending districts: ${districtPendingCount}

## Full-name QA
${namePriorityLines || "- none"}

## Manual Review Buckets
- manual-high-identity.csv: ${manualHighIdentityRows.length}
- manual-reading-only.csv: ${manualReadingOnlyRows.length}
- manual-reading-too-short.csv: ${manualReadingTooShortRows.length}
- manual-reading-mixed-suspect.csv: ${manualReadingMixedSuspectRows.length}
- manual-reading-visual-ok.csv: ${manualReadingVisualOkRows.length}
- manual-district-party-age.csv: ${manualDistrictPartyAgeRows.length}
- manual-district-party-age-real-needed.csv: ${manualDistrictPartyAgeRealNeededRows.length}
- manual-district-party-age-qa-reason-only.csv: ${manualDistrictPartyAgeQaReasonOnlyRows.length}
- manual-low-bulk-check.csv: ${manualLowBulkRows.length}

## Reason Counts
${reasonLines || "- none"}

## Manual Fix Flow
1. manual-review-real-needed.csv を優先確認する。
2. manual-reading-too-short.csv、manual-reading-mixed-suspect.csv、manual-reading-visual-ok.csv の順に読みを確認する。
3. manual-reading-visual-ok.csv を確認済みにする場合は npm run verify:reading-visual-ok:shugiin51 を実行し、reading-verified-candidates.csv に移す。
4. manual-high-identity.csv、manual-district-party-age.csv は別担当に分ける。
5. manual-review-qa-reason-only.csv は主要項目が埋まった後の過去QA理由だけなので、公開前の抜き取り確認に回す。
6. 修正後、公開用CSVへ反映する前に npm run qa:glossary:shugiin51 を再実行する。
7. photo-qa-report.csv で photoQa が ok 以外の行だけ写真を確認する。
`;
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

function readOption(name) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function loadVerifiedFullNames(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  return new Set(readCsv(filePath).map((row) => row.id).filter(Boolean));
}

function loadVerifiedReadings(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  return new Map(readCsv(filePath)
    .filter((row) => row.id && row.verified_reading)
    .map((row) => [row.id, row]));
}

function normalizeReadingReasons(row, reasons, verifiedReadings) {
  const verified = verifiedReadings.get(row.id);
  if (!verified) return reasons;
  if (normalizeReading(verified.verified_reading) !== normalizeReading(row.reading)) return reasons;
  return reasons.filter((reason) => reason !== "reading-suspicious");
}

function normalizeReading(value) {
  return String(value || "").replace(/\s+/g, "");
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

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function escapeCsv(value) {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}
