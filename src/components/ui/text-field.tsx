"use client";

import clsx from "@/lib/clsx";

interface SharedProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  name?: string;
}

export function TextField({
  value,
  onChange,
  placeholder,
  multiline,
  className,
  name,
  rows = 5,
}: SharedProps & { multiline?: boolean; rows?: number }) {
  const shared =
    "w-full font-body text-[13.5px] text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border";
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
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={clsx(shared, className)}
    />
  );
}
