import { redirect } from "next/navigation";

/**
 * The full list moved into a tab on /quote, so this route only exists to keep
 * old links and bookmarks working.
 */
export default function AllQuotesPage() {
  redirect("/quote?tab=all");
}
