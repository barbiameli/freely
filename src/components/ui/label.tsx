import { ReactNode } from "react";

export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="font-label text-[13px] tracking-wide text-slate mb-2.5 uppercase">
      {children}
    </div>
  );
}
