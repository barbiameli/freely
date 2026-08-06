const STEPS: [string, string][] = [
  ["01", "Source"],
  ["02", "Instructions"],
  ["03", "Output"],
];

export function Stepper({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex gap-3 items-center">
      {STEPS.map(([n, label], i) => {
        const active = i === activeIndex;
        return (
          <div key={n} className="flex items-center gap-3">
            <div
              className={`flex gap-2 items-center px-3.5 py-2.5 rounded-full ${
                active ? "bg-violet" : "bg-white border border-line"
              }`}
            >
              <span
                className={`font-body font-bold text-[11px] ${
                  active ? "text-white" : "text-text-muted"
                }`}
              >
                {n}
              </span>
              <span
                className={`font-body font-semibold text-[12.5px] ${
                  active ? "text-white" : "text-slate"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-line" />}
          </div>
        );
      })}
    </div>
  );
}
