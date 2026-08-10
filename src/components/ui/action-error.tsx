import { AlertCircle } from "lucide-react";

/**
 * A failed action, said plainly and in one place.
 *
 * Renders nothing when there is no error, so it can sit permanently in a
 * layout without reserving space, and every failure in the app looks the same
 * rather than each surface inventing its own treatment.
 */
export function ActionError({ error, className }: { error?: string; className?: string }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className={`flex items-start gap-1.5 text-overdue text-small leading-snug ${
        className ?? ""
      }`}
    >
      <AlertCircle size={13} className="shrink-0 mt-[1px]" />
      <span>{error}</span>
    </div>
  );
}
