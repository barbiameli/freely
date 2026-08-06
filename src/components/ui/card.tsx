import { HTMLAttributes } from "react";
import clsx from "@/lib/clsx";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "bg-white border border-line rounded-card px-6 py-[22px]",
        className
      )}
      {...rest}
    />
  );
}
