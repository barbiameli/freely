import { Check } from "lucide-react";

/** Two steps, not three: what you give it, then what comes out. The middle
 * "Instructions" step was mostly optional fields, which made the flow feel
 * longer than the work it was actually asking for. */
const STEPS: [string, string][] = [
  ["01", "The brief"],
  ["02", "The quote"],
];

/**
 * Progress through the wizard, and a way back.
 *
 * A step you have already finished is clickable: going back to change the
 * brief is a normal thing to want, and making the only route a Back button at
 * the bottom of a long page is a poor substitute. Completed steps are coral,
 * so they read as done rather than as the step you are on.
 */
export function Stepper({
  activeIndex,
  onStepClick,
}: {
  activeIndex: number;
  /** Called with the index of a completed step. Omit to make the stepper
   * purely decorative. */
  onStepClick?: (index: number) => void;
}) {
  return (
    <div className="flex gap-3 items-center">
      {STEPS.map(([n, label], i) => {
        const active = i === activeIndex;
        const done = i < activeIndex;
        const clickable = done && Boolean(onStepClick);

        const base = "flex gap-2 items-center px-3.5 py-2.5 rounded-full border transition-colors";
        const look = active
          ? "bg-violet border-violet"
          : done
          ? "bg-coral-tint border-coral"
          : "bg-white border-line";

        const content = (
          <>
            {done ? (
              <Check size={12} className="text-coral" />
            ) : (
              <span
                className={`font-body font-bold text-[11px] ${
                  active ? "text-white" : "text-text-muted"
                }`}
              >
                {n}
              </span>
            )}
            <span
              className={`font-body font-semibold text-[12.5px] ${
                active ? "text-white" : done ? "text-coral" : "text-slate"
              }`}
            >
              {label}
            </span>
          </>
        );

        return (
          <div key={n} className="flex items-center gap-3">
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick?.(i)}
                title={`Back to ${label.toLowerCase()}`}
                className={`${base} ${look} cursor-pointer hover:bg-coral-tint/70`}
              >
                {content}
              </button>
            ) : (
              <div className={`${base} ${look}`} aria-current={active ? "step" : undefined}>
                {content}
              </div>
            )}
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-line" />}
          </div>
        );
      })}
    </div>
  );
}
