import { SignUpForm } from "./signup-form";
import { Card } from "@/components/ui/card";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <Card className="w-full max-w-sm">
        <h1 className="font-display italic text-3xl text-coral mb-1">Freely</h1>
        <p className="text-slate text-sm mb-6">Set up your studio account.</p>
        <SignUpForm />
      </Card>
    </div>
  );
}
