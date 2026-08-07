"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import clsx from "@/lib/clsx";

/**
 * Drop-in replacement for the "<label><input type=file hidden />...</label>"
 * pattern used everywhere a file can be uploaded — adds real drag-and-drop
 * on top of the existing click-to-choose behavior, so both work from the
 * same element. Renders its own hidden <input>, so callers should stop
 * rendering their own when they switch to this.
 */
export function DropZone({
  onFile,
  accept,
  disabled,
  className,
  children,
}: {
  onFile: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={clsx(
        className,
        "transition-colors rounded-lg",
        dragOver && "outline outline-2 outline-violet outline-offset-2 bg-violet-tint"
      )}
    >
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      {children}
    </label>
  );
}
