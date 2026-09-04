import { redirect } from "next/navigation";
import { requireFullUser } from "@/lib/session";
import { Sidebar } from "@/components/sidebar";
import { Providers } from "@/components/providers";
import { TimerBar } from "@/components/track/timer-bar";
import { runningAnywhereAction } from "@/actions/time";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireFullUser();
  // First run after signup/first Google sign-in — send them to pick an
  // industry before they can use anything else.
  if (!user.industry) redirect("/onboarding");

  /**
   * Whatever clock is running, read once for the whole shell.
   *
   * A timer only visible on the project it belongs to is a timer that runs
   * through lunch, an afternoon on a different client, and occasionally a
   * night. Never fatal: a tracker that cannot be read is not a reason to
   * refuse somebody their app.
   */
  const timer = await runningAnywhereAction().catch(() => ({ ok: true, data: null }) as const);
  // No LocaleProvider here any more: it is mounted once at the root layout, so
  // every page gets it including the ones outside every route group, which is
  // where it kept being forgotten.
  return (
    <Providers>
      {/* Column on mobile with the nav pinned to the bottom, row with a rail
          on the left from md up. Bottom nav rather than a hamburger: five
          destinations that are all one tap away is better than five hidden
          behind a menu. */}
      {/* The canvas is paper, the cards are white.
          Everything sat on white with a hairline border, which made a page of
          six cards read as one flat sheet with lines drawn on it. One tone
          between the two is enough: the cards lift, the gaps between them
          become real, and nothing needed a shadow to do it. */}
      <div className="flex flex-col md:flex-row min-h-screen bg-paper">
        <Sidebar />
        {/* 56px each side was a lot of nothing next to a nav rail that already
            separates the content from the edge, and the project tracker is the
            screen that felt it: two columns, a timeline and a flags panel all
            competing for the same width. */}
        <div className="flex-1 min-w-0 px-5 py-6 pb-24 md:px-8 md:py-10 md:pb-12 xl:px-12 flex flex-col gap-5 md:gap-7">
          <TimerBar initial={timer.ok ? timer.data : null} />
          {children}
        </div>
      </div>
    </Providers>
  );
}
