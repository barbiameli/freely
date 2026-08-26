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

        <Section title={s.notStoredTitle}>
          <p>{s.notStoredPayment}</p>
          <p>{s.notStoredRemembered}</p>
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

        <Section title={s.liabilityTitle}>
          <p>{s.liabilityBody}</p>
        </Section>
      </main>
    </div>
  );
}
