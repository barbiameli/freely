import { SignUpForm } from "./signup-form";
import { Card } from "@/components/ui/card";
import { FreelyLogo } from "@/components/freely-logo";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <Card className="w-full max-w-sm">
        <div className="mb-1">
          <FreelyLogo />
        </div>
        <p className="text-slate text-sm mb-6">Set up your studio account.</p>
        <SignUpForm />
      </Card>
    </div>
  );
}
