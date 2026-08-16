"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Globe, Check } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
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
    // Bigger than a Prompt, on purpose. This is the one thing in Freely a
    // freelancer's competitors do not have, and it was a quiet line of text
    // that read as a setting. Three short facts, because the objections are
    // predictable: does my client need an account, do I have to keep writing
    // it, and can I take it down.
    return (
      <div className="w-full rounded-card border border-violet/30 bg-violet-tint px-4 py-4 sm:px-5 animate-card-in motion-reduce:animate-none">
        <div className="flex items-start gap-3.5">
          <span className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-violet shrink-0">
            <Globe size={17} className="text-white" />
          </span>
          <div className="min-w-0">
            <div className="font-body font-bold text-body text-ink text-pretty">
              {t.track.clientPageTitle}
            </div>
            <p className="text-small text-slate mt-1 mb-0 text-pretty">
              {t.track.clientPageBody}
            </p>

            <ul className="flex flex-col gap-1 list-none p-0 mt-3 mb-0">
              {[
                t.track.clientPagePoint1,
                t.track.clientPagePoint2,
                t.track.clientPagePoint3,
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-meta text-slate">
                  <Check size={13} className="text-violet shrink-0 mt-0.5" />
                  <span className="text-pretty">{line}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-3 mt-4">
              <Button icon={Globe} disabled={pending} onClick={publish} data-guide="client">
                {pending ? t.common.working : t.track.clientPageOpen}
              </Button>
              <span className="text-caption text-text-muted">{t.track.clientPageNotYet}</span>
            </div>
          </div>
        </div>
      </div>
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
