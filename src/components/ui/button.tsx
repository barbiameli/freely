"use client";

import { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import clsx from "@/lib/clsx";

/**
 * Four intents and two sizes, which is the whole vocabulary.
 *
 * `danger` exists because deleting was the one thing with no styling of its
 * own: every delete in the app was hand-built out of raw classes, so the most
 * irreversible action in the product looked different in each place it
 * appeared and never looked serious in any of them.
 *
 * `sm` exists for the same reason in the other direction. A row of small
 * actions inside a card was six different hand-rolled buttons, each with its
 * own padding and weight.
 */
type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  spinIcon?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-violet text-white border-none hover:opacity-90",
  outline: "bg-white text-violet border border-violet hover:bg-violet-tint",
  ghost: "bg-transparent text-slate border border-line hover:text-ink hover:border-slate",
  // Filled rather than outlined. An outlined destructive button reads as the
  // quieter option next to a filled Cancel, which is backwards.
  danger: "bg-overdue text-white border-none hover:opacity-90",
};

const sizeClasses: Record<Size, string> = {
  md: "text-sm px-5 py-3 rounded-lg",
  sm: "text-meta px-3.5 py-2 rounded-lg",
};

export function Button({
  variant = "primary",
  size = "md",
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
        "font-body font-bold inline-flex items-center justify-center gap-2 transition-[opacity,background-color,border-color,color]",
        sizeClasses[size],
        disabled ? "opacity-50 cursor-default pointer-events-none" : "cursor-pointer opacity-100",
        variantClasses[variant],
        className
      )}
      {...rest}
    >
      {Icon && <Icon size={size === "sm" ? 13 : 14} className={spinIcon ? "animate-spin-slow" : undefined} />}
      {children}
    </button>
  );
}
