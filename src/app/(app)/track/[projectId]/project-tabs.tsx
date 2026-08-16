"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n/context";

/**
 * The same project, from two sides.
 *
 * Track and Diary used to be separate sections holding the same work: the
 * diary mirrored the tracker's deliverables so you could choose what to
 * publish, which meant every project existed twice in the navigation and
 * changing one meant remembering the other. They were never two things. They
 * were one project and two audiences.
 *
 * So the audience is a tab. "Your work" is the steps, dates and questions you
 * keep to yourself. "What the client sees" is the published page and the
 * updates that go on it.
 *
 * In the URL rather than in state, so the client view can be linked to, opened
 * in a tab, and returned to by the back button.
 */
export function ProjectTabs({ projectId }: { projectId: string }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const client = params.get("view") === "client";

  return (
    <Tabs
      label={t.nav.track}
      items={[
        { id: "work", label: t.track.yourWork },
        { id: "client", label: t.track.clientView },
      ]}
      value={client ? "client" : "work"}
      onChange={(id) =>
        router.replace(
          id === "client" ? `/track/${projectId}?view=client` : `/track/${projectId}`,
          { scroll: false }
        )
      }
    />
  );
}
