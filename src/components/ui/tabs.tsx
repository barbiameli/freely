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
 * Quote, Invoices and the diary all grew their own copy of this within a day of
 * each other, and they had already started to differ in padding. One definition
 * means they stay the same control.
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
    <div role="tablist" aria-label={label} className="flex items-center gap-1 border-b border-line">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`font-body font-semibold text-small bg-none border-none cursor-pointer px-3.5 py-2.5 -mb-px border-b-2 transition-colors ${
              active
                ? "text-ink border-b-violet"
                : "text-text-muted border-b-transparent hover:text-slate"
            }`}
          >
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={`ml-1.5 tabular-nums text-caption ${
                  active ? "text-violet" : "text-text-muted"
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
