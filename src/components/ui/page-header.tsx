import type { ReactNode } from "react";

/**
 * The top of a page: what this is, one line about it, and the thing you came
 * to do.
 *
 * Every page had its own version of this. Two used a 32px display italic, one
 * used 30px stepping to 4xl, two had a subtitle and two did not, and the
 * button beside the title was aligned differently on each. None of that was
 * decided; it accumulated. A person moving between Track and Invoices reads
 * the difference as two products rather than as two pages.
 *
 * So: one component, one size, and a subtitle that is part of the header
 * rather than a paragraph somebody remembered to add. A page with nothing
 * useful to say in a subtitle leaves it out, which is different from a page
 * that wanted one and never got it.
 *
 * The action sits on the right on a wide screen and under the title on a
 * phone, because a primary button squeezed beside a wrapping title is the
 * thing that breaks first at 360px.
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  /** One line. If it needs two, it belongs in the page rather than up here. */
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
      <div className="min-w-0">
        <h1 className="font-display italic text-[32px] leading-[1.15] text-coral m-0 text-pretty">
          {title}
        </h1>
        {subtitle && (
          <p className="text-slate text-small mt-2 mb-0 max-w-prose text-pretty">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex flex-wrap gap-2.5 shrink-0">{action}</div>}
    </div>
  );
}

/**
 * A heading for a band of a long page.
 *
 * Between the page title and a card's own header there was nothing, so pages
 * that hold three unrelated groups of cards, like Account, ran them together
 * as one undifferentiated column. This is the missing level: smaller than the
 * page, louder than a card.
 */
export function SectionHeading({
  title,
  hint,
}: {
  title: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="mt-1">
      <h2 className="font-body font-bold text-lead text-ink m-0">{title}</h2>
      {hint && <p className="text-small text-slate mt-1 mb-0 max-w-prose text-pretty">{hint}</p>}
    </div>
  );
}
