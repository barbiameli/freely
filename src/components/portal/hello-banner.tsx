"use client";

import { useEffect, useState } from "react";
import { HelloForm } from "./hello-form";

/**
 * The one interactive thing on a Client Portal.
 *
 * The page itself is a server component with no form, no action and no client
 * boundary, and that is worth keeping: it means the answer to "what can an
 * unknown visitor do here" is a property of the file rather than a promise.
 * This is the single exception, and it can do exactly one thing, which is ask
 * for a link to be sent to an address.
 *
 * Skipping is remembered in localStorage rather than server-side, because
 * there is nothing to hang it on: somebody who declines to say who they are
 * has, by construction, no row. Per-browser is the honest scope for a
 * per-browser decision.
 */
export function HelloBanner({ slug }: { slug: string }) {
  const key = `portal-hello-skipped:${slug}`;
  /*
   * Starts hidden and appears after mount.
   *
   * The server cannot know what localStorage says, so rendering it as shown
   * and hiding it on the client would flash the question at somebody who
   * already dismissed it, on every single visit.
   */
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(key)) setShow(true);
    } catch {
      // Storage can throw in a locked-down browser. Asking is the safe
      // default: worst case somebody sees the question twice.
      setShow(true);
    }
  }, [key]);

  if (!show) return null;

  return (
    <section className="bg-white rounded-card border border-line shadow-card px-5 sm:px-7 py-6">
      <HelloForm
        slug={slug}
        onSkip={() => {
          try {
            window.localStorage.setItem(key, "1");
          } catch {
            // Nothing to do. It will be asked again next time, which is a
            // small annoyance rather than a failure.
          }
          setShow(false);
        }}
      />
    </section>
  );
}
