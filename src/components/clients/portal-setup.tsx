"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { BlocksPanel, type SavedBlock } from "@/components/clients/blocks-panel";
import { DescribeStep } from "@/components/clients/describe-step";
import { SectionToggle } from "@/components/clients/section-toggle";
import { AccessPanel, type PortalPerson } from "@/components/clients/access-panel";
import { DocumentsPanel, type ClientDocument } from "@/components/clients/documents-panel";
import { UpdatesPanel, type UpdatableProject } from "@/components/clients/updates-panel";
import { setTimeDetailAction } from "@/actions/portal";
import { useT } from "@/lib/i18n/context";

export interface PortalSettings {
  showProjects: boolean;
  showQuotes: boolean;
  showInvoices: boolean;
  showTime: boolean;
  showDocuments: boolean;
  showUpdates: boolean;
  timeDetail: string;
}

/**
 * Everything about the client's page, one question at a time.
 *
 * It began as five panels down a long screen, became one dialog, and the one
 * dialog was still the same five panels stacked: a switch deciding whether a
 * client sees money sat two screens of scrolling below the words that
 * introduce the project, and nothing on it said where to start.
 *
 * So: four steps, in the order the decisions actually get made. Say how you
 * work and have the steps written. Read them. Decide what they can see. Say
 * who may open it. Each screen holds one kind of thinking, and the last one
 * ends at the thing that was always the point, which is looking at it.
 *
 * Everything still saves as it is changed. There is no Save anywhere in here,
 * so closing it halfway is never losing anything, moving backwards is free,
 * and the numbered steps are buttons rather than a track: somebody who came
 * back only to switch invoices off should not have to walk past their own
 * welcome note to do it.
 */

const STEPS = ["describe", "words", "sections", "access"] as const;
type Step = (typeof STEPS)[number];

export function PortalSetup({
  open,
  onClose,
  clientId,
  publicSlug,
  blocks,
  settings,
  people,
  documents,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  publicSlug: string;
  blocks: SavedBlock[];
  settings: PortalSettings;
  people: PortalPerson[];
  documents: ClientDocument[];
  projects: UpdatableProject[];
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState(0);

  const step: Step = STEPS[at];
  const last = at === STEPS.length - 1;
  const titles: Record<Step, string> = {
    describe: t.setup.describeTitle,
    words: t.blocks.title,
    sections: t.setup.sectionsTitle,
    access: t.visitors.title,
  };
  const hints: Record<Step, string> = {
    describe: t.setup.describeStepHint,
    words: t.blocks.hint,
    sections: t.setup.sectionsHint,
    access: t.visitors.hint,
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titles[step]}
      hint={hints[step]}
      wide
      footer={
        <div className="flex items-center gap-2.5 flex-wrap w-full">
          {/* The way back on the left, always in the same place, and absent
              rather than disabled on the first step: a greyed control is
              something to work out, and there is nothing behind step one. */}
          {at > 0 && (
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setAt(at - 1)}>
              {t.setup.back}
            </Button>
          )}
          <span className="flex-1" />
          {last ? (
            <>
              <a
                href={`/c/${publicSlug}?preview=1&welcome=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-body font-bold text-sm text-ink bg-white border-[1.5px] border-ink rounded-full px-5 py-3 no-underline press hover:bg-ink hover:text-white transition-colors"
              >
                <Eye size={15} />
                {t.setup.preview}
              </a>
              <Button onClick={onClose}>{t.setup.done}</Button>
            </>
          ) : (
            <Button icon={ArrowRight} onClick={() => setAt(at + 1)}>
              {t.setup.next}
            </Button>
          )}
        </div>
      }
    >
      {/* Where you are, and a way to jump. Four segments rather than a
          percentage: the useful fact is how much is left, and with four of
          anything that is countable at a glance. */}
      <div className="flex items-center gap-1.5 mb-4" aria-label={t.setup.stepsLabel}>
        {STEPS.map((name, index) => (
          // The bar is 6px and the button is not. Padding rather than .tap,
          // because .tap reaches 15px each way and four of these sit 6px
          // apart, so the hit areas would overlap and a tap near a boundary
          // would jump to the wrong step.
          <button
            key={name}
            type="button"
            onClick={() => setAt(index)}
            aria-current={index === at ? "step" : undefined}
            aria-label={titles[name]}
            className="flex-1 bg-none border-none cursor-pointer px-0 py-2.5"
          >
            <span
              className={`block h-1.5 rounded-full transition-colors ${
                index <= at ? "bg-violet" : "bg-line"
              }`}
            />
          </button>
        ))}
        <span className="font-label text-caption text-text-muted tabular-nums ml-1.5 shrink-0">
          {t.setup.stepOf.replace("{n}", String(at + 1)).replace("{total}", String(STEPS.length))}
        </span>
      </div>

      {step === "describe" && (
        <DescribeStep
          clientId={clientId}
          hasWords={blocks.some((block) => block.body.trim())}
          // Straight to reading what came back. Writing them and then asking
          // somebody to press Next to see them is one press that has only one
          // sensible answer.
          onWritten={() => setAt(1)}
        />
      )}

      {step === "words" && <BlocksPanel clientId={clientId} saved={blocks} bare />}

      {step === "sections" && (
        <div className="flex flex-col">
          <SectionToggle
            clientId={clientId}
            section="showUpdates"
            on={settings.showUpdates}
            title={t.sectionNames.updates}
            hint={t.sectionNames.updatesHint}
          >
            <UpdatesPanel projects={projects} bare />
          </SectionToggle>

          <SectionToggle
            clientId={clientId}
            section="showDocuments"
            on={settings.showDocuments}
            title={t.sectionNames.documents}
            hint={t.sectionNames.documentsHint}
          >
            <DocumentsPanel clientId={clientId} documents={documents} bare />
          </SectionToggle>

          <SectionToggle
            clientId={clientId}
            section="showProjects"
            on={settings.showProjects}
            title={t.sectionNames.projects}
            hint={t.sectionNames.projectsHint}
          />

          <SectionToggle
            clientId={clientId}
            section="showQuotes"
            on={settings.showQuotes}
            title={t.sectionNames.quotes}
            hint={t.sectionNames.quotesHint}
          />

          <SectionToggle
            clientId={clientId}
            section="showInvoices"
            on={settings.showInvoices}
            title={t.sectionNames.invoices}
            hint={t.sectionNames.invoicesHint}
          />

          <SectionToggle
            clientId={clientId}
            section="showTime"
            on={settings.showTime}
            title={t.sectionNames.time}
            hint={t.sectionNames.timeHint}
            warning={settings.timeDetail === "entries" ? t.sectionNames.timeWarning : undefined}
          >
            {/* How much, once it is on at all. The real question is only
                whether the notes travel, so there are two answers rather than
                a slider. */}
            <div className="flex flex-wrap gap-1.5">
              {(["entries", "totals"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  disabled={busy}
                  aria-pressed={settings.timeDetail === level}
                  onClick={async () => {
                    setBusy(true);
                    await setTimeDetailAction(clientId, level);
                    setBusy(false);
                    router.refresh();
                  }}
                  className={`rounded-full px-3.5 py-2 text-caption font-semibold cursor-pointer border transition-colors ${
                    settings.timeDetail === level
                      ? "border-violet bg-violet-tint text-ink"
                      : "border-line bg-white text-slate hover:border-ink"
                  }`}
                >
                  {level === "entries" ? t.sectionNames.timeEntries : t.sectionNames.timeTotals}
                </button>
              ))}
            </div>
          </SectionToggle>

          <p className="text-caption text-text-muted mt-4 pt-4 border-t border-line mb-0">
            <strong className="text-ink">{t.setup.filesTitle}</strong> {t.setup.filesHint}
          </p>
        </div>
      )}

      {/* Not a switch. A page nobody can open is not a hidden section, it is a
          page with nobody on the list. */}
      {step === "access" && <AccessPanel clientId={clientId} people={people} bare />}
    </Modal>
  );
}
