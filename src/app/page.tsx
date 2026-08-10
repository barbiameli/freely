import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { currentLocale } from "@/lib/i18n/server";
import { dict } from "@/lib/i18n";
import { Marketing } from "./marketing";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (user) redirect("/quote");

  const locale = await currentLocale();
  return <Marketing t={dict(locale)} locale={locale} />;
}
