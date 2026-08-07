import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Marketing } from "./marketing";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (user) redirect("/quote");
  return <Marketing />;
}
