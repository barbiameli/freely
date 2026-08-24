import { hintForScreen } from "@/actions/guide";
import { CoachMark } from "@/components/guide/coach-mark";
import type { GuideStep } from "@/lib/guide";

/**
 * Decides on the server whether this screen has anything to say.
 *
 * Server side so that a page with no hint ships no guide code at all, and so
 * the counts behind the decision are read in the same round trip as the page
 * rather than as a request the browser makes after painting.
 *
 * A screen can claim a step for itself and exclude it here. The quote wizard
 * does, for the two first-quote hints: whether to show the second one depends
 * on what is typed into the form, which is not something a server component
 * can know. Excluding rather than letting both render is what keeps the "one
 * at a time" rule true.
 */
export async function GuideMount({
  screen,
  exclude = [],
}: {
  screen: string;
  exclude?: GuideStep[];
}) {
  const step = await hintForScreen(screen);
  if (!step || exclude.includes(step)) return null;
  return <CoachMark step={step} />;
}
