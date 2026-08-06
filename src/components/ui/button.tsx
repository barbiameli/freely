"use client";

import { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import clsx from "@/lib/clsx";

type Variant = "primary" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: LucideIcon;
  spinIcon?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-violet text-white border-none",
  outline: "bg-white text-violet border border-violet",
  ghost: "bg-transparent text-slate border border-line",
};

export function Button({
  variant = "primary",
  icon: Icon,
  spinIcon,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={clsx(
        "font-body font-bold text-sm px-5 py-3 rounded-lg inline-flex items-center gap-2 transition-opacity",
        disabled ? "opacity-50 cursor-default" : "cursor-pointer opacity-100",
        variantClasses[variant],
        className
      )}
      {...rest}
    >
      {Icon && <Icon size={14} className={spinIcon ? "animate-spin-slow" : undefined} />}
      {children}
    </button>
  );
}
