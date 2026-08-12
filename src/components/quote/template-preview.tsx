/**
 * A drawn thumbnail of each quote template.
 *
 * Names alone ("Classic", "Editorial", "Minimal") do not tell anybody what
 * they are picking, and a real screenshot would go stale the first time a
 * template changed. Drawn in markup it is sharp at any size and cheap enough
 * to sit inside a row that is usually closed.
 *
 * No hooks and no text, so it renders anywhere and needs no translation.
 */
export type TemplateId = "classic" | "editorial" | "minimal";

export function TemplatePreview({ id }: { id: TemplateId }) {
  if (id === "classic") {
    return (
      <div className="w-full h-20 rounded-md bg-white border border-line overflow-hidden flex flex-col">
        <div className="bg-ink h-8 px-2.5 flex flex-col justify-center gap-1">
          <div className="w-8 h-[3px] bg-coral rounded-full" />
          <div className="w-14 h-[5px] bg-white/90 rounded-full" />
        </div>
        <div className="flex-1 px-2.5 py-2 flex flex-col gap-1.5">
          <div className="w-full h-2 rounded bg-violet-tint" />
          <div className="w-4/5 h-2 rounded bg-coral-tint" />
        </div>
      </div>
    );
  }
  if (id === "editorial") {
    return (
      <div className="w-full h-20 rounded-md bg-white border border-line overflow-hidden px-2.5 py-2.5 flex flex-col gap-1.5">
        <div className="w-10 h-[3px] bg-coral rounded-full" />
        <div className="w-16 h-3 bg-ink/80 rounded-sm" />
        <div className="w-full h-[2px] bg-coral mt-0.5" />
        <div className="w-full h-1.5 rounded bg-line mt-1" />
        <div className="w-3/5 h-1.5 rounded bg-line" />
      </div>
    );
  }
  return (
    <div className="w-full h-20 rounded-md bg-white border border-line overflow-hidden px-2.5 py-2.5 flex flex-col gap-1.5">
      <div className="w-full h-[3px] bg-ink" />
      <div className="w-12 h-2 bg-ink/70 rounded-sm mt-1" />
      <div className="w-full h-1 rounded bg-line mt-1.5" />
      <div className="w-2/3 h-1 rounded bg-line" />
    </div>
  );
}
