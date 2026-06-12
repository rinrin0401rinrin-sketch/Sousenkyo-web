import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { assertSafeElectionId, publicDataRoot, readJson } from './data-utils.mjs';

const electionId = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? readCurrentElectionId();
const requireFinalResults = process.argv.includes('--final-results') || process.env.REQUIRE_FINAL_RESULTS === 'true';
const skipSmokePreview = process.env.RELEASE_CHECK_SKIP_SMOKE === 'true';
const confirmedStatuses = new Set(['elected', 'proportionalRevival']);
const placeholderStatuses = new Set(['counting', 'pending']);

if (!electionId) {
  console.error('Usage: npm run release:check -- <electionId>');
  process.exit(1);
}

try {
  assertSafeElectionId(electionId);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const releaseGateErrors = validateReleaseEligibility(electionId, { requireFinalResults });
if (releaseGateErrors.length > 0) {
  console.error(`Release eligibility gate failed for ${electionId}:`);
  for (const error of releaseGateErrors) console.error(`ERROR ${error}`);
  process.exit(1);
}

const steps = [
  ['npm', ['run', 'scan:secrets']],
  ['npm', ['run', 'scan:release-text', '--', electionId]],
  ['npm', ['run', 'gen:data:dry', '--', electionId]],
  ['npm', ['run', 'gen:glossary:dry']],
  ['npm', ['run', 'validate:materials:strict']],
  ['npm', ['run', 'validate:data:strict']],
  ['npm', ['run', 'report:data:check', '--', electionId]],
  ['npm', ['run', 'build']],
];

if (!skipSmokePreview) steps.push(['npm', ['run', 'smoke:preview']]);

for (const [command, args] of steps) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  await run(command, args);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

function readCurrentElectionId() {
  try {
    return readJson(join(publicDataRoot, 'active-election.json')).currentId;
  } catch {
    return undefined;
  }
}

function validateReleaseEligibility(targetElectionId, options) {
  const errors = [];
  const active = readJson(join(publicDataRoot, 'active-election.json'));
  const index = readJson(join(publicDataRoot, 'elections-index.json'));
  const election = index.elections?.find((entry) => entry.id === targetElectionId);

  if (!election) {
    return [`public/data/elections-index.json に ${targetElectionId} が存在しません`];
  }

  const isReleaseTarget =
    active.currentId === targetElectionId || election.status === 'current' || election.isDataReady === true;
  if (!isReleaseTarget) {
    console.log(`Release eligibility gate skipped for ${targetElectionId}: active/current/isDataReady ではありません`);
    return errors;
  }

  const electionDir = join(publicDataRoot, targetElectionId);
  const summary = readJson(join(electionDir, 'summary.json'));
  const blocks = readJson(join(electionDir, 'proportional-blocks.json')).proportionalBlocks ?? [];
  const singleResults = readJson(join(electionDir, 'single-member-districts.json')).singleMemberDistricts ?? [];
  const proportionalResults = readJson(join(electionDir, 'results.json')).proportionalSeats ?? [];
  const allResults = [...singleResults, ...proportionalResults];
  const hasConfirmedResults = allResults.some((result) => confirmedStatuses.has(result.status));
  const hasPlaceholderResults = allResults.some((result) => placeholderStatuses.has(result.status));
  const hasPartySeats = (summary.partySeats ?? []).length > 0;
  const reportingRate = typeof summary.reportingRate === 'number' ? summary.reportingRate : 0;
  const isFinalResultsLike = options.requireFinalResults || reportingRate === 100 || hasConfirmedResults || hasPartySeats;

  if (!isFinalResultsLike && hasPlaceholderResults) {
    console.log(
      `Release eligibility gate: ${targetElectionId} は候補者/準備データとして公開します。最終結果公開時は --final-results を付けてください。`,
    );
    return errors;
  }

  const placeholderResults = allResults.filter((result) => placeholderStatuses.has(result.status));
  if (placeholderResults.length > 0) {
    errors.push(
      `${targetElectionId}: pending/counting の結果が ${placeholderResults.length} 件残っています (${sampleIds(
        placeholderResults,
      )})`,
    );
  }

  if (summary.reportingRate !== 100) {
    errors.push(`${targetElectionId}/summary.json: reportingRate は 100 である必要があります (現在: ${summary.reportingRate ?? '未設定'})`);
  }

  const zeroConfirmedResults = allResults.filter(
    (result) =>
      confirmedStatuses.has(result.status) &&
      (('votes' in result && isZeroOrMissing(result.votes)) ||
        isZeroOrMissing(result.voteRate) ||
        isZeroOrMissing(result.turnout)),
  );
  if (zeroConfirmedResults.length > 0) {
    errors.push(
      `${targetElectionId}: confirmed status なのに votes/voteRate/turnout が 0 または未設定の結果が ${
        zeroConfirmedResults.length
      } 件あります (${sampleIds(zeroConfirmedResults)})`,
    );
  }

  validateSummarySeatConsistency(targetElectionId, summary, blocks, singleResults, proportionalResults, errors);
  return errors;
}

function validateSummarySeatConsistency(electionId, summary, blocks, singleResults, proportionalResults, errors) {
  if (summary.districtSeats + summary.proportionalSeats !== summary.totalSeats) {
    errors.push(
      `${electionId}/summary.json: totalSeats(${summary.totalSeats}) と districtSeats + proportionalSeats(${
        summary.districtSeats + summary.proportionalSeats
      }) が一致しません`,
    );
  }

  const blockSeatTotal = blocks.reduce((total, block) => total + numeric(block.seats), 0);
  if (blockSeatTotal !== summary.proportionalSeats) {
    errors.push(
      `${electionId}/summary.json: proportionalSeats(${summary.proportionalSeats}) と proportional-blocks seats合計(${blockSeatTotal}) が一致しません`,
    );
  }

  const singleSeatTotal = singleResults.length;
  if (singleSeatTotal !== summary.districtSeats) {
    errors.push(
      `${electionId}/summary.json: districtSeats(${summary.districtSeats}) と single-member-districts件数(${singleSeatTotal}) が一致しません`,
    );
  }

  const confirmedSeatTotal = countConfirmedSingleSeats(singleResults) + countConfirmedProportionalSeats(proportionalResults);
  if (confirmedSeatTotal !== summary.totalSeats) {
    errors.push(
      `${electionId}/summary.json: totalSeats(${summary.totalSeats}) と確定結果議席合計(${confirmedSeatTotal}) が一致しません`,
    );
  }

  const partySeatTotal = (summary.partySeats ?? []).reduce((total, seat) => total + numeric(seat.seats), 0);
  if (partySeatTotal !== summary.totalSeats) {
    errors.push(`${electionId}/summary.json: partySeats合計(${partySeatTotal}) と totalSeats(${summary.totalSeats}) が一致しません`);
  }

  const estimatedPartySeats = estimatePartySeats(singleResults, proportionalResults);
  const summaryPartySeats = new Map((summary.partySeats ?? []).map((seat) => [seat.partyId, numeric(seat.seats)]));
  for (const [partyId, estimatedSeats] of estimatedPartySeats) {
    const summarySeats = summaryPartySeats.get(partyId) ?? 0;
    if (summarySeats !== estimatedSeats) {
      errors.push(`${electionId}/summary.partySeats.${partyId}: summary(${summarySeats}) と結果データ(${estimatedSeats}) が一致しません`);
    }
  }
}

function countConfirmedSingleSeats(singleResults) {
  return singleResults.filter((result) => confirmedStatuses.has(result.status)).length;
}

function countConfirmedProportionalSeats(proportionalResults) {
  return proportionalResults.reduce((total, result) => {
    if (!confirmedStatuses.has(result.status)) return total;
    return total + numeric(result.seats);
  }, 0);
}

function estimatePartySeats(singleResults, proportionalResults) {
  const seatsByParty = new Map();
  const addSeats = (partyId, seats) => {
    if (!partyId) return;
    seatsByParty.set(partyId, (seatsByParty.get(partyId) ?? 0) + seats);
  };

  for (const result of singleResults) {
    if (confirmedStatuses.has(result.status)) addSeats(result.partyId, 1);
  }

  for (const result of proportionalResults) {
    if (confirmedStatuses.has(result.status)) addSeats(result.partyId, numeric(result.seats));
  }

  return seatsByParty;
}

function isZeroOrMissing(value) {
  return typeof value !== 'number' || !Number.isFinite(value) || value === 0;
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function sampleIds(results) {
  const ids = results.slice(0, 5).map((result) => result.id ?? 'id未設定');
  return `${ids.join(', ')}${results.length > ids.length ? ', ...' : ''}`;
}
