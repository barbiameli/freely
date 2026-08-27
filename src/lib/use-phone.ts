"use client";

import { useEffect, useState } from "react";

/** Tailwind's sm. Below this the layout is one column and a panel anchored to
 * a button has nowhere to go. */
const PHONE = "(max-width: 639px)";

/**
 * Whether this is a phone-width screen, right now.
 *
 * Tailwind handles almost everything with breakpoint prefixes, and that is the
 * right tool: it costs nothing, it works before hydration, and it cannot get
 * out of step with itself. This exists for the cases where the two widths need
 * different markup rather than different classes, which is a much smaller set:
 * a dropdown that should be a sheet, a popover that should be a dialog.
 *
 * It starts false and corrects itself on mount, so the server and the first
 * client render agree and React has nothing to complain about. That means a
 * phone briefly renders the desktop shape, which is fine for a panel that only
 * exists once something is pressed, and is the reason this must not be used
 * for anything visible on load.
 */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(PHONE);
    setPhone(query.matches);
    const onChange = (event: MediaQueryListEvent) => setPhone(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return phone;
}
