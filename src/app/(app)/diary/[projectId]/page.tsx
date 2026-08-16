import { redirect } from "next/navigation";

/**
 * The diary is a tab on the project now, not a section of its own.
 *
 * Kept as a redirect rather than deleted, because these links are in people's
 * history, in emails Freely has already sent, and in whatever anybody
 * bookmarked. A 404 for a project that still exists is a worse answer than a
 * redirect that will be here for as long as it costs nothing.
 */
export default function DiaryProjectPage({ params }: { params: { projectId: string } }) {
  redirect(`/track/${params.projectId}?view=client`);
}
