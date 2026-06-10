import type { ElectionBundle, ResultStatus } from '../types/election';

const confirmedStatuses = new Set<ResultStatus>(['elected', 'proportionalRevival']);
const unsettledStatuses = new Set<ResultStatus>(['counting', 'pending']);

export type ElectionReadiness = {
  hasConfirmedResults: boolean;
  hasUnsettledResults: boolean;
  isCandidateRosterMode: boolean;
  modeLabel: string;
  resultNotice: string;
};

export function getElectionReadiness(bundle: ElectionBundle): ElectionReadiness {
  const allResults = [...bundle.results.singleMemberDistricts, ...bundle.results.proportionalSeats];
  const hasConfirmedResults = allResults.some((result) => confirmedStatuses.has(result.status));
  const hasUnsettledResults = allResults.some((result) => unsettledStatuses.has(result.status));
  const hasPartySeats = bundle.summary.partySeats.length > 0;
  const reportingRate = bundle.summary.reportingRate ?? 0;
  const hasResultNumbers = reportingRate > 0 || hasPartySeats || hasConfirmedResults;
  const isCandidateRosterMode = allResults.length > 0 && hasUnsettledResults && !hasResultNumbers;

  return {
    hasConfirmedResults,
    hasUnsettledResults,
    isCandidateRosterMode,
    modeLabel: isCandidateRosterMode ? '候補者データ公開中' : '選挙結果公開中',
    resultNotice: isCandidateRosterMode
      ? '開票結果はまだ反映されていません。現在は候補者、選挙区、比例ブロックの準備データを表示しています。'
      : 'JSONに反映された開票結果を表示しています。',
  };
}

export function isResultPending(status: ResultStatus): boolean {
  return unsettledStatuses.has(status);
}
