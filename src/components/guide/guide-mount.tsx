import { hintForScreen } from "@/actions/guide";
import { CoachMark } from "@/components/guide/coach-mark";

/**
 * Decides on the server whether this screen has anything to say.
 *
 * Server side so that a page with no hint ships no guide code at all, and so
 * the counts behind the decision are read in the same round trip as the page
 * rather than as a request the browser makes after painting.
 */
export async function GuideMount({ screen }: { screen: string }) {
  const step = await hintForScreen(screen);
  if (!step) return null;
  return <CoachMark step={step} />;
}
