"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";

/**
 * Asking before something irreversible happens.
 *
 * This replaces four calls to the browser's confirm(), which had three
 * problems. It looked like the operating system rather than like Freely, so
 * the most serious moment in the app was the one that felt least like it. It
 * gave one line of text and no room to say what was actually about to be lost.
 * And deleting an account asked twice in a row, which trains people to click
 * through both.
 *
 * So one dialog, with room to list what goes, and a button that says the verb
 * rather than "OK". "Delete project" is a sentence somebody can check against
 * their intention. "OK" is a reflex.
 *
 * The destructive button is on the right and filled red. Cancel sits to its
 * left as a quiet button, because a Cancel with equal weight makes somebody
 * read both to work out which is which.
 */
export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  hint,
  /** What is about to be lost, when it is worth listing. */
  children,
  /** The verb, e.g. "Delete project". Never "OK". */
  confirmLabel,
  working,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  hint?: string;
  children?: ReactNode;
  confirmLabel: string;
  working?: boolean;
}) {
  const t = useT();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      hint={hint}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={working}>
            {t.common.cancel}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={working}>
            {working ? t.common.deleting : confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

/**
 * The same dialog, with its own open state, for the common case.
 *
 * Most callers only want a button that asks first. Holding the state here
 * keeps four lines of useState out of every component that deletes something.
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  return {
    open,
    ask: () => setOpen(true),
    close: () => setOpen(false),
  };
}
