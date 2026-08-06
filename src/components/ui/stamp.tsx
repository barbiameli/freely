export type StampStatus = "ACTIVE" | "DUE" | "OVERDUE" | "DONE" | "DRAFT" | "TRACKED";

const STATUS_COLORS: Record<StampStatus, string> = {
  ACTIVE: "border-violet text-violet",
  DUE: "border-coral text-coral",
  OVERDUE: "border-overdue text-overdue",
  DONE: "border-success text-success",
  DRAFT: "border-violet text-violet",
  TRACKED: "border-slate text-slate",
};

function label(status: StampStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function Stamp({ status, size = 56 }: { status: StampStatus; size?: number }) {
  const classes = STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT;
  return (
    <div
      style={{ width: size, height: size, transform: "rotate(-6deg)" }}
      className={`rounded-full border-[1.5px] border-dashed flex items-center justify-center flex-shrink-0 ${classes}`}
    >
      <div
        style={{ width: size - 14, height: size - 14 }}
        className={`rounded-full border flex items-center justify-center ${classes}`}
      >
        <span
          style={{ fontSize: size * 0.16 }}
          className="font-label text-center"
        >
          {label(status)}
        </span>
      </div>
    </div>
  );
}
