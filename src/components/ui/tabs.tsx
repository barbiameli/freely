"use client";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** A count beside the label. Hidden when zero, since "0" is noise. */
  badge?: number;
}

/**
 * The tab strip, in one place.
 *
 * Quote, Invoices, Diary and Memory each grew their own copy of this within days
 * of each other and had already started to differ. One definition means they
 * stay the same control, which matters more than usual here: tabs are the only
 * navigation inside a page, so four slightly different ones teach you to look
 * for them in four different ways.
 *
 * It was an underline: a 2px violet rule under the selected label, with the rest
 * in muted grey. Quiet enough to miss entirely, which people did. The problem
 * was not the weight of the marker, it was that nothing said "this is a control"
 * until you had already found it.
 *
 * So it is a segmented control now, on a track. The track is the part that does
 * the work: an enclosed shape reads as something to press before any of the
 * labels are read. The selected tab is a solid violet pill, the same treatment
 * an active Chip has everywhere else in the app, so it is new furniture rather
 * than a new idea.
 *
 * Scrolls sideways rather than wrapping. Four tabs on a phone will not fit, and
 * a strip that wraps to two lines stops reading as one control.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** For screen readers, naming what these tabs switch between. */
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex items-center gap-1 bg-paper border border-line rounded-full p-1 max-w-full overflow-x-auto"
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`font-body font-semibold text-small rounded-full border-none cursor-pointer px-4 py-2 whitespace-nowrap transition-colors ${
              active
                ? "bg-violet text-white"
                : "bg-transparent text-slate hover:text-ink hover:bg-white"
            }`}
          >
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={`ml-1.5 tabular-nums text-caption ${
                  active ? "text-white/75" : "text-text-muted"
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
