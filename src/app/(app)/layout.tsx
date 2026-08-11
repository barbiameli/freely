import { redirect } from "next/navigation";
import { requireFullUser } from "@/lib/session";
import { Sidebar } from "@/components/sidebar";
import { Providers } from "@/components/providers";
import { LocaleProvider } from "@/lib/i18n/context";
import { currentLocale } from "@/lib/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireFullUser();
  // First run after signup/first Google sign-in — send them to pick an
  // industry before they can use anything else.
  if (!user.industry) redirect("/onboarding");
  // currentLocale, not the user's locale column. This layout used to read the
  // column directly while every server component inside it read currentLocale,
  // which checks the cookie first. When the two disagreed, and they disagree
  // for anyone who picked a language on the marketing page before signing in,
  // the page came out in both: a Spanish heading from the server dictionary
  // above English client components, with the switcher showing EN.
  const locale = await currentLocale();
  return (
    <Providers>
      <LocaleProvider locale={locale}>
      {/* Column on mobile with the nav pinned to the bottom, row with a rail
          on the left from md up. Bottom nav rather than a hamburger: five
          destinations that are all one tap away is better than five hidden
          behind a menu. */}
      <div className="flex flex-col md:flex-row min-h-screen bg-white">
        <Sidebar />
        <div className="flex-1 min-w-0 px-5 py-6 pb-24 md:px-14 md:py-12 md:pb-12 flex flex-col gap-5 md:gap-7">
          {children}
        </div>
      </div>
      </LocaleProvider>
    </Providers>
  );
}
