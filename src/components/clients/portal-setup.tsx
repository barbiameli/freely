"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { BlocksPanel, type SavedBlock } from "@/components/clients/blocks-panel";
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
 * Everything about the client's page, in one dialog.
 *
 * It was five panels down a long screen, which meant setting a portal up was
 * a scroll and a hunt, and the switch deciding whether a client sees money sat
 * four cards away from the thing it decided. One place, one order, and a
 * preview at the end.
 *
 * Every section is a switch and its contents together, because they are the
 * same decision made twice. Switched off, the contents collapse: there is
 * nothing to arrange about a section nobody will see.
 *
 * Everything saves as it is changed. There is no Save at the bottom, so
 * closing this is never losing anything, and the preview is always of what is
 * actually stored rather than of a draft.
 */
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.setup.title}
      hint={t.setup.hint}
      wide
      footer={
        <div className="flex items-center gap-2.5 flex-wrap">
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
        </div>
      }
    >
      <div className="flex flex-col">
        {/* First, because it is the only part that is words rather than a
            switch, and the part somebody came here to write. */}
        <div className="border-b border-line pb-4">
          <p className="font-body font-semibold text-small text-ink m-0">{t.blocks.title}</p>
          <p className="text-caption text-text-muted mt-0.5 mb-2.5">{t.blocks.hint}</p>
          <BlocksPanel clientId={clientId} saved={blocks} bare />
        </div>

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
          warning={
            settings.timeDetail === "entries" ? t.sectionNames.timeWarning : undefined
          }
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

        {/* Not a switch. A page nobody can open is not a hidden section, it
            is a page with nobody on the list. */}
        <div className="pt-4">
          <p className="font-body font-semibold text-small text-ink m-0">{t.visitors.title}</p>
          <p className="text-caption text-text-muted mt-0.5 mb-2.5">{t.visitors.hint}</p>
          <AccessPanel clientId={clientId} people={people} bare />
        </div>

        <p className="text-caption text-text-muted mt-4 pt-4 border-t border-line mb-0">
          <strong className="text-ink">{t.setup.filesTitle}</strong> {t.setup.filesHint}
        </p>
      </div>
    </Modal>
  );
}
