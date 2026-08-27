import Link from "next/link";
import { FreelyLogo } from "@/components/freely-logo";
import { serverDict } from "@/lib/i18n/server";
import { CLAUSES, SUBPROCESSORS, LAST_UPDATED, PRIVACY_CONTACT } from "@/lib/dpa";

export const metadata = {
  title: "Data Processing Agreement, Freely",
};

/**
 * The countersignable version of the terms page.
 *
 * The terms page describes what Freely does with data and can be changed
 * whenever Freely likes. This is an obligation, required in writing by Article
 * 28 wherever one party processes personal data on behalf of another, which is
 * exactly what happens when somebody puts a client's details into a brief.
 *
 * Published rather than negotiated per customer, the way Neon and Vercel do
 * it: one document, incorporated into the terms by reference, downloadable by
 * anybody whose procurement wants a signature. That scales to a thousand
 * customers where per-customer redlines scale to about four.
 *
 * English only. The reasoning is the reverse of the terms page and is set out
 * in lib/dpa.
 */
export default async function DpaPage() {
  const t = await serverDict();

  return (
    <div className="min-h-screen bg-white">
      <header className="max-w-2xl mx-auto flex items-center justify-between px-5 sm:px-6 py-6">
        <Link href="/" aria-label={t.marketing.home}>
          <FreelyLogo size="sm" />
        </Link>
        <Link href="/terms" className="text-small font-semibold text-violet">
          Terms and data
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-5 sm:px-6 pb-20">
        <h1 className="font-display italic text-[32px] text-coral m-0">
          Data Processing Agreement
        </h1>
        <p className="text-slate text-body mt-2">
          Where you put another person&apos;s details into Freely, you are the controller of that
          data and Freely is your processor. Article 28 of the GDPR requires that to be written
          down. This is it.
        </p>
        <p className="text-caption text-text-muted mt-2 mb-0">Last updated {LAST_UPDATED}.</p>

        {CLAUSES.map((clause) => (
          <section key={clause.number} className="border-t border-line pt-6 mt-6">
            <h2 className="font-body font-bold text-lead text-ink m-0">
              {clause.number}. {clause.title}
            </h2>
            <div className="text-body leading-relaxed text-slate flex flex-col gap-2.5 mt-2">
              {clause.body.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="m-0">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}

        {/* The list clause 6 refers to. On the same page as the clause that
            authorises it, since a sub-processor list on a separate page is one
            that gets out of step with the agreement pointing at it. */}
        <section className="border-t border-line pt-6 mt-6">
          <h2 className="font-body font-bold text-lead text-ink m-0 mb-1">
            The sub-processors, in full
          </h2>
          <p className="text-body leading-relaxed text-slate mt-0 mb-4">
            These four and no others. Each one&apos;s own agreement is linked, so you can read
            what they commit to rather than taking it from us.
          </p>
          <div className="flex flex-col">
            {SUBPROCESSORS.map((sub) => (
              <div key={sub.name} className="py-3.5 border-b border-line/70 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="font-body font-bold text-small text-ink">{sub.name}</span>
                  <a
                    href={sub.terms}
                    target="_blank"
                    rel="noreferrer"
                    className="text-caption font-semibold text-violet"
                  >
                    Their terms
                  </a>
                </div>
                <p className="text-small text-slate mt-1 mb-0 text-pretty">{sub.purpose}</p>
                <p className="text-caption text-text-muted mt-0.5 mb-0">{sub.location}</p>
              </div>
            ))}
          </div>
        </section>

        {/* An address, at the end, where somebody who has just read fifteen
            clauses about their rights would look for one. */}
        <section className="border-t border-line pt-6 mt-6">
          <h2 className="font-body font-bold text-lead text-ink m-0 mb-1">Asking about any of this</h2>
          <p className="text-body leading-relaxed text-slate mt-0 mb-0">
            Data protection questions, requests from your own clients, and requests for a
            countersigned copy all go to{" "}
            <a href={`mailto:${PRIVACY_CONTACT}`} className="text-violet font-semibold">
              {PRIVACY_CONTACT}
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
