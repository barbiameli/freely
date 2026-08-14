"use client";

import clsx from "@/lib/clsx";

interface SharedProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  name?: string;
  /**
   * The input type, for the handful of cases where it matters.
   *
   * "password" is the one that earns this: without it a browser renders the
   * characters, offers no password manager, and helpfully saves the value into
   * autofill as ordinary text.
   */
  type?: "text" | "password" | "email";
  autoComplete?: string;
}

export function TextField({
  value,
  onChange,
  placeholder,
  multiline,
  className,
  name,
  type,
  autoComplete,
  rows = 5,
}: SharedProps & { multiline?: boolean; rows?: number }) {
  const shared =
    "w-full font-body text-body text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border";
  if (multiline) {
    return (
      <textarea
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={clsx(shared, "resize-y", className)}
      />
    );
  }
  return (
    <input
      name={name}
      type={type}
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={clsx(shared, className)}
    />
  );
}
