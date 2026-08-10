import { redirect } from "next/navigation";
import { requireFullUser } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { OnboardingForm } from "./onboarding-form";
import { serverDict } from "@/lib/i18n/server";

export default async function OnboardingPage() {
  const t = await serverDict();
  const user = await requireFullUser();
  // Already onboarded — nothing to do here.
  if (user.industry) redirect("/quote");

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-5 py-8 sm:p-6">
      <Card className="w-full max-w-lg">
        <h1 className="font-display italic text-3xl text-coral mb-1">{t.onboarding.whatWork}</h1>
        <p className="text-slate text-sm mb-6">{t.onboarding.intro}</p>
        <OnboardingForm />
      </Card>
    </div>
  );
}
