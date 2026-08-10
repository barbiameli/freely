/**
 * The project's numbers, on ink.
 *
 * These were four white cards among a page of white cards, so the figures that
 * summarise the whole project carried no more weight than a form field. One
 * dark band instead: it reads as the header of the page rather than another
 * item on it, and the numbers can be large without shouting because they are
 * the only thing on that surface.
 */
export interface Stat {
  label: string;
  value: string;
  /** Draws attention when something is wrong. */
  alert?: boolean;
  /** For the good case, sparingly. */
  good?: boolean;
}

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="bg-ink rounded-card px-5 py-4 md:px-6 md:py-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-4">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <div className="font-label text-caption uppercase tracking-[0.09em] text-white/45">
              {stat.label}
            </div>
            <div
              className={`font-body font-bold text-[19px] leading-tight mt-1 truncate ${
                stat.alert ? "text-coral" : stat.good ? "text-mint-solid" : "text-white"
              }`}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
