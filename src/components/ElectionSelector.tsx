import { Link } from 'react-router-dom';
import type { ElectionIndexItem } from '../types/election';

type ElectionSelectorProps = {
  elections: ElectionIndexItem[];
  currentId: string;
};

export function ElectionSelector({ elections, currentId }: ElectionSelectorProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {elections.map((election) => {
        const isCurrent = election.id === currentId;
        const isDataReady = election.isDataReady ?? isCurrent;
        const className = `min-w-[13rem] rounded-3xl border p-4 text-left transition ${
          isCurrent
            ? 'border-sky-200 bg-sky-50 text-sky-950'
            : isDataReady
              ? 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
              : 'border-slate-200 bg-white/65 text-slate-500'
        }`;
        const statusLabel = isCurrent ? '現在表示中' : election.status === 'past' ? '過去選挙' : '今後の選挙';
        const content = (
          <>
            <span className="text-xs font-bold text-slate-500">{election.type}</span>
            <p className="mt-1 text-base font-bold">{election.name}</p>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              {isDataReady ? statusLabel : `${statusLabel} / データ準備中`}
            </p>
          </>
        );

        if (!isDataReady) {
          return (
            <div key={election.id} className={className} aria-disabled="true">
              {content}
            </div>
          );
        }

        return (
          <Link key={election.id} to={`/elections/${election.id}`} className={className}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
