import Link from "next/link";
import { FreelyLogo } from "@/components/freely-logo";

export const metadata = {
  title: "Terms and data, Freely",
};

/**
 * Terms and data handling.
 *
 * This exists so the product surfaces do not have to explain data handling in
 * passing. A form field should say what happens; the detail belongs here.
 *
 * Not legal advice and not a substitute for a lawyer-reviewed agreement.
 * Anyone taking this to production should have it reviewed.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-6 mt-6">
      <h2 className="font-body font-bold text-lead text-ink m-0 mb-2">{title}</h2>
      <div className="text-body leading-relaxed text-slate flex flex-col gap-2.5">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="max-w-2xl mx-auto flex items-center justify-between px-5 sm:px-6 py-6">
        <Link href="/" aria-label="Home">
          <FreelyLogo size="sm" />
        </Link>
        <Link href="/quote" className="text-small font-semibold text-violet">
          Back to Freely
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-5 sm:px-6 pb-20">
        <h1 className="font-display italic text-[32px] text-coral m-0">Terms and data</h1>
        <p className="text-slate text-body mt-2">
          What Freely stores, what it does not, and the terms of using it.
        </p>

        <Section title="What we store">
          <p>
            Your account details (name, studio name, email), everything you add to Memory
            (instructions, tone, story, context, uploaded files, images and links), the quotes and
            projects you create, and the invoices you build.
          </p>
          <p>
            Uploaded files are stored as extracted text so quotes can draw on them. Images and
            logos are stored as data on your account.
          </p>
        </Section>

        <Section title="What we do not store">
          <p>
            Bank account numbers, sort codes, IBANs, card details and any other payment
            credentials. Invoices have no database fields for them. You enter them at the moment
            you download an invoice, they are written into that PDF, and they are discarded.
          </p>
          <p>
            If you tick &quot;remember these on this device&quot;, they are kept in your own
            browser storage and are not sent to us. Clearing your browser data removes them.
          </p>
        </Section>

        <Section title="Published quotes are public">
          <p>
            Publishing a quote puts it at a web address that anyone with the link can open. The
            address is long and unguessable, and it is not listed anywhere, but it is not behind a
            login. Unpublish a quote to take it offline.
          </p>
        </Section>

        <Section title="AI generation">
          <p>
            Quotes are drafted by an AI model from the brief you provide and the context in your
            Memory. That content is sent to the model provider to produce the draft.
          </p>
          <p>
            Drafts can be wrong. Prices, hours and timelines are estimates and every quote is
            yours to check and edit before you send it.
          </p>
        </Section>

        <Section title="Accepting a quote">
          <p>
            When a client accepts a published quote, we record the name and email they typed, the
            time, and the IP address the acceptance came from, as a record that it happened. This
            is a simple electronic signature. For agreements where you need a formal audit trail,
            use a dedicated e-signature service.
          </p>
        </Section>

        <Section title="Your data">
          <p>
            You can edit or delete quotes, projects, invoices and Memory items at any time.
            Deleting your account removes the data associated with it.
          </p>
        </Section>

        <Section title="Liability">
          <p>
            Freely is a tool for producing documents. It does not provide legal, tax or financial
            advice, and the wording it generates, including any terms, is a starting point for you
            to review.
          </p>
        </Section>
      </main>
    </div>
  );
}
