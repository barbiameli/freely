import { prisma } from "@/lib/prisma";
import { inCatalogueOrder } from "@/lib/onboarding-blocks";

/**
 * Reading the blocks, in a library rather than in the actions file.
 *
 * The portal page must not import from `@/actions/` at all, and there is a
 * test that says so. A read is harmless in itself, but the rule is worth
 * keeping exact: "this page cannot reach anything that writes" is checkable,
 * and "this page only reaches the harmless things in the file that writes" is
 * an argument somebody has to have again every time.
 */
export async function blocksForClient(
  clientId: string
): Promise<{ kind: string; title: string; body: string }[]> {
  const rows = await (
    prisma as unknown as {
      onboardingBlock: {
        findMany(args: {
          where: { clientId: string };
        }): Promise<{ kind: string; title: string; body: string }[]>;
      };
    }
  ).onboardingBlock.findMany({ where: { clientId } });
  // Anything not in the catalogue is dropped here, so removing a kind from
  // lib/onboarding-blocks stops it being shown without a data change.
  return inCatalogueOrder(rows);
}
