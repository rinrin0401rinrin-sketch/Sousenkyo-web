import type { Party } from '../../types/election';
import type { ElectionMapItem } from '../../utils/resultFilters';
import { statusLabels, statusTone } from './statusLabels';

type JapanElectionDotMapProps = {
  items: ElectionMapItem[];
  parties: Party[];
  selectedItemId?: string;
  onSelect: (item: ElectionMapItem) => void;
};

export function JapanElectionDotMap({ items, parties, selectedItemId, onSelect }: JapanElectionDotMapProps) {
  const partyColor = (partyId: string) => parties.find((party) => party.id === partyId)?.color ?? '#94a3b8';

  return (
    <div className="relative min-h-[34rem] overflow-hidden rounded-[2rem] border border-white/70 bg-white/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl sm:min-h-[42rem] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(125,211,252,0.22),transparent_26%),radial-gradient(circle_at_45%_65%,rgba(226,232,240,0.55),transparent_36%)]" />
      <div className="pointer-events-none absolute bottom-8 right-10 h-28 w-40 rounded-[50%] border border-white/70 opacity-60 blur-[1px]" />
      <div className="relative h-[30rem] sm:h-[38rem]">
        <div className="absolute left-[10%] top-[10%] rounded-full border border-white/60 bg-white/55 px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm backdrop-blur-xl">
          全国ドットマップ
        </div>
        {items.map((item) => {
          const color = partyColor(item.partyId);
          const isSelected = item.id === selectedItemId;
          const size = item.layer === 'proportional' ? 22 + item.z * 3 : 18 + item.z * 2;

          return (
            <button
              key={`${item.layer}-${item.id}`}
              type="button"
              onClick={() => onSelect(item)}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/60 transition duration-200 hover:-translate-y-[55%] hover:scale-110 focus:outline-none focus:ring-4 focus:ring-sky-200 ${statusTone(item.status)} ${
                isSelected ? 'z-20 scale-125 ring-4 ring-slate-950/15' : 'z-10'
              }`}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                width: size,
                height: size,
                background: `linear-gradient(180deg, rgba(255,255,255,0.88), ${color})`,
                boxShadow: `0 ${Math.max(5, item.z * 1.6)}px ${Math.max(16, item.z * 4)}px ${color}66, inset 0 3px 6px rgba(255,255,255,0.8), inset 0 -4px 8px rgba(15,23,42,0.16)`,
              }}
              aria-label={`${item.subLabel} ${item.label} ${item.partyName} ${statusLabels[item.status]}`}
            >
              {item.status === 'proportionalRevival' ? (
                <span className="h-2 w-2 rounded-full border-2 border-white/90 bg-transparent" />
              ) : item.layer === 'proportional' ? (
                <span className="h-1.5 w-3 rounded-full bg-white/85" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
