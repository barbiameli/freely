import { splitDeliverable } from "@/lib/rich-text";

/**
 * Deliverables, with the name separated from what it covers.
 *
 * Shared by the brief page and every public template so a quote reads the
 * same wherever it is opened. The marker is a render prop because each
 * template has its own idea of one: a tick, a number, a dash.
 */
export function DeliverableList({
  deliverables,
  marker,
  leadClass = "font-body font-semibold text-[15px] text-ink leading-snug",
  detailClass = "text-[13.5px] text-slate leading-relaxed mt-1.5",
  gap = "gap-4",
}: {
  deliverables: string[];
  marker?: (index: number) => React.ReactNode;
  leadClass?: string;
  detailClass?: string;
  gap?: string;
}) {
  return (
    <div className={`flex flex-col ${gap}`}>
      {deliverables.map((d, i) => {
        const { lead, detail } = splitDeliverable(d);
        return (
          <div key={i} className="flex items-start gap-2.5">
            {marker?.(i)}
            <div className="min-w-0 flex-1">
              <div className={leadClass}>{lead}</div>
              {detail && <div className={detailClass}>{detail}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
