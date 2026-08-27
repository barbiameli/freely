import Link from "next/link";
import { FreelyLogo } from "@/components/freely-logo";
import { serverDict } from "@/lib/i18n/server";

export const metadata = {
  title: "Terms and data, Freely",
};

/**
 * Terms and data handling.
 *
 * This exists so the product surfaces do not have to explain data handling in
 * passing. A form field should say what happens; the detail belongs here.
 *
 * In both languages now. It was left in English on the reasoning that a
 * mistranslated liability clause is worse than an English one, which was
 * overcautious: this is plain-language description of what the product does
 * with data, not a contract, and a Spanish freelancer being unable to read what
 * is stored about them is the worse outcome.
 *
 * Still not legal advice and not a substitute for a lawyer-reviewed agreement,
 * in either language. Anyone taking this to production should have it reviewed.
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

export default async function TermsPage() {
  const t = await serverDict();
  const s = t.terms;

  return (
    <div className="min-h-screen bg-white">
      <header className="max-w-2xl mx-auto flex items-center justify-between px-5 sm:px-6 py-6">
        <Link href="/" aria-label={t.marketing.home}>
          <FreelyLogo size="sm" />
        </Link>
        <Link href="/quote" className="text-small font-semibold text-violet">
          {s.backToFreely}
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-5 sm:px-6 pb-20">
        <h1 className="font-display italic text-[32px] text-coral m-0">{s.title}</h1>
        <p className="text-slate text-body mt-2">{s.intro}</p>

        <Section title={s.storeTitle}>
          <p>{s.storeAccount}</p>
          <p>{s.storeFiles}</p>
        </Section>

        {/* The obvious follow-up question, answered before it is asked: if the
            invoice is stored, how are the bank details on it not? Because the
            PDF is built at download time and never kept, so the two live in
            different places. Leaving that unsaid made the section read as a
            contradiction. */}
        <Section title={s.notStoredTitle}>
          <p>{s.notStoredPayment}</p>
          <p>{s.notStoredPaymentHow}</p>
        </Section>

        <Section title={s.publicTitle}>
          <p>{s.publicBody}</p>
        </Section>

        <Section title={s.aiTitle}>
          <p>{s.aiBody}</p>
          <p>{s.aiRetention}</p>
          <p>{s.aiDrafts}</p>
        </Section>

        {/* Named, rather than "our providers". Somebody asking this question
            is asking who exactly, and a list of three companies answers it
            where a category does not. */}
        <Section title={s.whereTitle}>
          <p>{s.whereBody}</p>
          <p>{s.whereNoOthers}</p>
          {/* "How do you know they are not using it?" is the right
              follow-up, and the answer is that it is contractual and
              audited rather than a promise. Naming the documents lets
              somebody check instead of believing us. */}
          <p>{s.whereHow}</p>
          <p>{s.whereRead}</p>
        </Section>

        {/* The question every careful person asks and most policies avoid.
            Both halves are here: the product shows nobody your work, and the
            person running it holds database credentials. Saying only the first
            would be true and misleading. */}
        <Section title={s.accessTitle}>
          <p>{s.accessBody}</p>
          <p>{s.accessAdmin}</p>
        </Section>

        <Section title={s.acceptTitle}>
          <p>{s.acceptBody}</p>
        </Section>

        <Section title={s.yourDataTitle}>
          <p>{s.yourDataBody}</p>
        </Section>

        {/* Said before the agreement rather than after it. Somebody reading a
            data protection page for a product that has never charged anybody
            deserves to know that up front, and deserves to know it changes
            none of the obligations underneath. */}
        <Section title={s.freeTitle}>
          <p className="text-body leading-relaxed text-slate m-0">{s.freeBody}</p>
        </Section>

        {/* Where the question usually gets asked, so the answer is one
            click from it rather than something to be told about. */}
        <Section title={s.dpaTitle}>
          <p>{s.dpaBody}</p>
          <p className="m-0">
            <Link href="/dpa" className="text-violet font-semibold">
              {s.dpaLink}
            </Link>
          </p>
        </Section>

        <Section title={s.liabilityTitle}>
          <p>{s.liabilityBody}</p>
        </Section>
      </main>
    </div>
  );
}
