import { redirect } from "next/navigation";

/** See diary/[projectId]/page.tsx. The list of projects is Track's list. */
export default function DiaryPage() {
  redirect("/track");
}
