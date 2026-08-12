/**
 * The project's numbers, one card each.
 *
 * Two revisions in. They started as four white cards among a page of white
 * cards, which gave the figures summarising the whole project no more weight
 * than a form field. Making them one dark band fixed the weight and introduced
 * two new problems: the labels sat at white/45 on #343434, which measures
 * about 4:1 and fails the 4.5:1 minimum for small text, and one continuous bar
 * read as a single object rather than four separate readings.
 *
 * Now: separate cards with real gaps between them, and labels at white/70,
 * which measures 6.99:1.
 *
 * One thing to know before reusing these colours: coral on ink is 3.88:1,
 * which clears the 3:1 bar for large text and only because these values are
 * 19px bold. It would fail on anything smaller.
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
  // auto-fit rather than a fixed column count. There are four of these on most
  // projects and five on one billed per milestone, and a fixed four left the
  // fifth stranded alone on a second row. Two per row on a phone, because a
  // label like "Deliverables done" at a quarter of 390px is a truncation.
  return (
    <div className="grid grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-ink rounded-card px-4 py-3.5 min-w-0 flex flex-col justify-between gap-2"
        >
          <div className="font-label text-caption uppercase tracking-[0.09em] text-white/70">
            {stat.label}
          </div>
          <div
            className={`font-body font-bold text-[19px] leading-tight truncate ${
              stat.alert ? "text-coral" : stat.good ? "text-mint-solid" : "text-white"
            }`}
          >
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
