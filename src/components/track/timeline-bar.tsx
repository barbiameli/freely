import { formatDay, relativeDay, daysBetween } from "@/lib/schedule";

export interface TimelineMarker {
  id: string;
  name: string;
  dueAt: Date;
  done: boolean;
}

/**
 * The project on a line, with a marker per deliverable and where today sits.
 *
 * A list of dates makes you do the arithmetic. A line does it for you: how
 * much of the run is gone, what is bunched up at the end, what has already
 * slipped past today without being ticked.
 */
export function TimelineBar({
  startDate,
  dueDate,
  markers,
  now = new Date(),
}: {
  startDate: Date;
  dueDate: Date;
  markers: TimelineMarker[];
  now?: Date;
}) {
  const span = Math.max(1, daysBetween(startDate, dueDate));
  const at = (date: Date) => Math.min(100, Math.max(0, (daysBetween(startDate, date) / span) * 100));
  const todayAt = at(now);
  const past = now > dueDate;

  return (
    <div>
      <div className="flex justify-between text-caption text-text-muted mb-2">
        <span>{formatDay(startDate)}</span>
        <span className={past ? "text-overdue font-semibold" : ""}>
          {formatDay(dueDate)} · {relativeDay(dueDate, now)}
        </span>
      </div>

      <div className="relative h-1.5 rounded-full bg-line">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-violet-tint"
          style={{ width: `${todayAt}%` }}
        />
        {/* Today, as a full-height tick rather than a dot, so it reads as a
            position on the line rather than another deliverable. */}
        <div
          className="absolute -top-1 bottom-[-4px] w-[2px] bg-ink rounded-full"
          style={{ left: `${todayAt}%` }}
          title={`Today, ${formatDay(now)}`}
        />
        {markers.map((m) => {
          const overdue = !m.done && m.dueAt < now;
          return (
            <div
              key={m.id}
              title={`${m.name} · ${formatDay(m.dueAt)}`}
              style={{ left: `${at(m.dueAt)}%` }}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-white ${
                m.done ? "bg-success" : overdue ? "bg-overdue" : "bg-coral"
              }`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-caption text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-coral" /> Due
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success" /> Done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-overdue" /> Past the date
        </span>
      </div>
    </div>
  );
}
