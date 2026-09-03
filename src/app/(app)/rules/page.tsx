import { redirect } from "next/navigation";

/**
 * The rules moved into a tab on Memory, which is where every other standing
 * decision about how you work already lived. This route only exists so old
 * links, bookmarks and the flags on a quote keep landing somewhere.
 */
export default function RulesPage() {
  redirect("/memory?tab=rules");
}
