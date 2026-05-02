import type { ElectionVisual } from '../types/election';

type ElectionVisualGalleryProps = {
  visuals?: ElectionVisual[];
  featuredOnly?: boolean;
};

export function ElectionVisualGallery({ visuals = [], featuredOnly = false }: ElectionVisualGalleryProps) {
  const visibleVisuals = featuredOnly ? visuals.slice(0, 3) : visuals;

  if (visibleVisuals.length === 0) {
    return null;
  }

  return (
    <section className="glass-panel overflow-hidden p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500">Visual Assets</p>
          <h2 className="text-2xl font-black text-slate-950">総選挙Webビジュアル</h2>
        </div>
        <span className="glass-chip w-fit text-slate-600">{visibleVisuals.length} images</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 lg:grid-cols-3">
        {visibleVisuals.map((visual, index) => (
          <article
            key={visual.id}
            className={`glass-gallery-card ${index === 0 && !featuredOnly ? 'lg:col-span-2' : ''}`}
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.35rem] bg-slate-100">
              <img
                src={visual.imageUrl}
                alt={visual.alt}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                loading="lazy"
              />
              <div className="absolute inset-x-2 bottom-2 rounded-2xl border border-white/60 bg-white/75 p-3 shadow-sm backdrop-blur-xl">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{visual.role}</p>
                <h3 className="mt-1 line-clamp-1 text-base font-black leading-tight text-slate-950">{visual.title}</h3>
                {visual.description ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{visual.description}</p>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
