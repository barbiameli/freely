import Link from "next/link";
import { dict } from "@/lib/i18n";
import { currentLocale } from "@/lib/i18n/server";

/** A page that isn't there, or a quote that has been deleted. Without this,
 * Next's default 404 is an unstyled page with no way back into the app. */
export default async function NotFound() {
  const t = dict(await currentLocale());

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display italic text-[32px] text-coral m-0">
        {t.errors.notFoundTitle}
      </h1>
      <p className="text-slate text-body mt-2 max-w-[380px]">
        {t.errors.notFoundBody}
      </p>
      <Link
        href="/quote"
        className="font-body font-bold text-sm text-white bg-violet rounded-lg px-4 py-2.5 mt-5 no-underline"
      >
        {t.errors.backToFreely}
      </Link>
    </div>
  );
}
