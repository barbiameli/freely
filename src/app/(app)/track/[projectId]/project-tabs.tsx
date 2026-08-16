"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Globe } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Prompt } from "@/components/ui/prompt";
import { Button } from "@/components/ui/button";
import { setPublishedAction } from "@/actions/diary";
import { useAction } from "@/lib/use-action";
import { useT } from "@/lib/i18n/context";

/**
 * The same project, from two sides, once there are two sides.
 *
 * Track and Diary used to be separate sections holding the same work, which
 * meant every project existed twice in the navigation. They were never two
 * things. They were one project and two audiences, so the audience is a tab.
 *
 * The tabs only appear once the client page exists. Before that there is
 * nothing on the other side to look at, and a tab labelled "What the client
 * sees" leading to an unpublished page is a promise the app has not kept. It
 * also buried the single most distinctive thing Freely does behind a control
 * nobody had a reason to press.
 *
 * So an unpublished project gets a card that says what a client page is and
 * offers to make one. Pressing it publishes and moves to that side, which is
 * the whole feature in one click.
 */
export function ProjectTabs({
  projectId,
  published,
}: {
  projectId: string;
  published: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const { run, pending } = useAction();
  const client = params.get("view") === "client";

  async function publish() {
    const result = await run(() => setPublishedAction(projectId, true), { skipRefresh: true });
    if (result.ok) router.push(`/track/${projectId}?view=client`);
  }

  if (!published) {
    return (
      <Prompt
        level="attention"
        className="w-full"
        title={t.track.clientPageTitle}
        body={t.track.clientPageBody}
        actions={
          <Button
            size="sm"
            icon={Globe}
            disabled={pending}
            onClick={publish}
            data-guide="client"
          >
            {pending ? t.common.working : t.track.clientPageOpen}
          </Button>
        }
      />
    );
  }

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
