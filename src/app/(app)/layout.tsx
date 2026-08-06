import { redirect } from "next/navigation";
import { requireFullUser } from "@/lib/session";
import { Sidebar } from "@/components/sidebar";
import { Providers } from "@/components/providers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireFullUser();
  // First run after signup/first Google sign-in — send them to pick an
  // industry before they can use anything else.
  if (!user.industry) redirect("/onboarding");
  return (
    <Providers>
      <div className="flex min-h-screen bg-white">
        <Sidebar />
        <div className="flex-1 px-14 py-12 flex flex-col gap-7">{children}</div>
      </div>
    </Providers>
  );
}
