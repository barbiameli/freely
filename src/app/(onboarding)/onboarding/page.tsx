import { redirect } from "next/navigation";
import { requireFullUser } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requireFullUser();
  // Already onboarded — nothing to do here.
  if (user.industry) redirect("/quote");

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-6">
      <Card className="w-full max-w-lg">
        <h1 className="font-display italic text-3xl text-coral mb-1">What kind of work do you do?</h1>
        <p className="text-slate text-sm mb-6">
          A few quick questions so Freely has real context before you generate your first quote —
          each one after this is optional, but the more it knows, the more accurate quotes will
          be. Everything here can be changed later in Memory.
        </p>
        <OnboardingForm />
      </Card>
    </div>
  );
}
