import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { hasOwnBranding } from "@/lib/branding";
import type { AccountDefaults } from "@/lib/quote-defaults";
import { MemoryView } from "./memory-view";

export default async function MemoryPage() {
  const user = await requireFullUser();
  const [assets, connections] = await Promise.all([
    prisma.memoryAsset.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, name: true, dataUrl: true, url: true, createdAt: true },
    }),
    prisma.connection.findMany({
      where: { userId: user.id },
      select: { provider: true, accountLabel: true, createdAt: true },
    }),
  ]);

  return (
    <MemoryView
      industry={user.industry}
      aiPersona={user.aiPersona}
      personaUpdatedAt={user.personaUpdatedAt?.toISOString() ?? null}
      initialInstructions={user.memoryInstructions}
      initialTone={user.toneNotes}
      initialStory={user.storyNotes}
      initialContext={user.contextNotes}
      brandPrimaryColor={user.brandPrimaryColor}
      brandAccentColor={user.brandAccentColor}
      brandLogoDataUrl={user.brandLogoDataUrl}
      brandHeadingFont={user.brandHeadingFont}
      brandBodyFont={user.brandBodyFont}
      currency={user.currency}
      country={(user as unknown as { country: string | null }).country ?? null}
      quoteLocale={(user as unknown as { quoteLocale: string | null }).quoteLocale ?? null}
      hasBrand={hasOwnBranding(user)}
      // Cast rather than selected: the quote setup columns are newer than the
      // generated Prisma client here, so narrowing would return them undefined
      // and the page would show an empty setup over saved values.
      saved={user as unknown as AccountDefaults}
      files={assets
        .filter((a) => a.type === "FILE")
        .map((a) => ({ id: a.id, name: a.name, createdAt: a.createdAt.toISOString() }))}
      images={assets
        .filter((a) => a.type === "IMAGE")
        .map((a) => ({
          id: a.id,
          name: a.name,
          dataUrl: a.dataUrl!,
          createdAt: a.createdAt.toISOString(),
        }))}
      links={assets
        .filter((a) => a.type === "LINK")
        .map((a) => ({ id: a.id, name: a.name, url: a.url!, createdAt: a.createdAt.toISOString() }))}
      connections={connections.map((c) => ({
        provider: c.provider,
        accountLabel: c.accountLabel,
        connectedAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
