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
        <p className="text-slate text-sm mb-6">
          A few quick questions so Freely has real context before you generate your first quote -
          each one after this is optional, but the more it knows, the more accurate quotes will
          be. Everything here can be changed later in Memory.
        </p>
        <OnboardingForm />
      </Card>
    </div>
  );
}
