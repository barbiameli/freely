import { SignUpForm } from "./signup-form";
import { Card } from "@/components/ui/card";
import { FreelyLogo } from "@/components/freely-logo";
import { serverDict } from "@/lib/i18n/server";

export default async function SignUpPage() {
  const t = await serverDict();
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-5 py-10">
      <Card className="w-full max-w-sm">
        <div className="mb-1">
          <FreelyLogo />
        </div>
        <p className="text-slate text-sm mb-6">{t.auth.setUpStudio}</p>
        <SignUpForm />
      </Card>
    </div>
  );
}
