import type { Party } from '../types/election';

type PartyBadgeProps = {
  party?: Party;
};

export function PartyBadge({ party }: PartyBadgeProps) {
  if (!party) {
    return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">未設定</span>;
  }

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm backdrop-blur-xl"
      title={party.name}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: party.color }} />
      {party.shortName ?? party.name}
    </span>
  );
}
