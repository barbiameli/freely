"use client";

import { useState, type ReactNode } from "react";
import { WelcomeSteps, type WelcomeStep } from "./welcome-steps";

/**
 * Whether the client is being welcomed or getting on with it.
 *
 * The steps and the dashboard are one screen at two moments, so this holds the
 * one piece of state that decides which, and hands the dashboard straight back
 * when the steps are finished. Doing it here rather than by navigating means
 * pressing Done does not cost a page load, and the dashboard is already
 * rendered behind it: the markup arrives from the server either way, and this
 * only chooses what is shown.
 */
export function PortalShell({
  slug,
  steps,
  studio,
  seen,
  children,
}: {
  slug: string;
  steps: WelcomeStep[];
  studio: string;
  seen: boolean;
  children: ReactNode;
}) {
  const [welcoming, setWelcoming] = useState(!seen && steps.length > 0);

  if (welcoming) {
    return (
      <WelcomeSteps
        slug={slug}
        steps={steps}
        studio={studio}
        onDone={() => setWelcoming(false)}
      />
    );
  }
  return <>{children}</>;
}
