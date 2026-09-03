import { requireFullUser } from "@/lib/session";
import { parseRuleSettings } from "@/lib/ground-rules";
import { RulesView } from "./rules-view";

export default async function RulesPage() {
  const user = await requireFullUser();
  // Cast rather than selected: groundRules is newer than the generated client
  // in some environments, and narrowing there would return it undefined and
  // show the starter set over somebody's saved choices.
  const settings = parseRuleSettings(
    (user as unknown as { groundRules?: unknown }).groundRules
  );
  return <RulesView settings={settings} />;
}
