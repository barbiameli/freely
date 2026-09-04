"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { GROUND_RULES, parseRuleSettings, type RuleKey } from "@/lib/ground-rules";
import type { PatternFix } from "@/lib/quote-patterns";

/**
 * Making the change a pattern suggests.
 *
 * The patterns used to name a problem and link to a settings page, and the
 * link said "Your ground rules" whichever problem it was. So it told nobody
 * which rule, or what to change about it, and left the actual work where it
 * started. Each pattern now carries the change itself and this performs it.
 *
 * Deliberately small and specific. Nothing here alters a quote that has
 * already been written: these are standing preferences, and a change to one is
 * a decision about the next quote rather than a rewrite of the last twenty.
 */
export async function applyPatternFixAction(
  fix: PatternFix
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireFullUser();
    const settings = parseRuleSettings(
      (user as unknown as { groundRules?: unknown }).groundRules
    );

    const writeRules = async (next: Record<string, unknown>) => {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          groundRules: { ...settings, ...next } as unknown as Prisma.InputJsonValue,
        } as unknown as Parameters<typeof prisma.user.update>[0]["data"],
      });
    };

    switch (fix.action) {
      case "ruleOn": {
        if (!fix.rule || !GROUND_RULES.some((rule) => rule.key === fix.rule)) {
          return { ok: false, error: "That is not one of the rules." };
        }
        await writeRules({ off: settings.off.filter((key) => key !== (fix.rule as RuleKey)) });
        break;
      }
      case "setPaymentDays":
      case "setAcceptanceDays": {
        const key = fix.action === "setPaymentDays" ? "paymentDays" : "acceptanceDays";
        if (!fix.amount || fix.amount < 1 || fix.amount > 120) {
          return { ok: false, error: "That is not a usable number of days." };
        }
        await writeRules({ values: { ...settings.values, [key]: Math.round(fix.amount) } });
        break;
      }
      case "setDeposit": {
        if (fix.amount == null || fix.amount < 0 || fix.amount > 100) {
          return { ok: false, error: "That is not a usable percentage." };
        }
        // Two changes, because one without the other does nothing: the split
        // is the plan, and the percentage is what the plan means.
        await writeRules({
          values: { ...settings.values, depositPercent: Math.round(fix.amount) },
        });
        await prisma.user.update({
          where: { id: user.id },
          data: {
            defaultPaymentPlan: "SPLIT",
            defaultUpfrontPercent: Math.round(fix.amount),
          } as unknown as Parameters<typeof prisma.user.update>[0]["data"],
        });
        break;
      }
      case "setRate": {
        if (!fix.amount || fix.amount <= 0 || fix.amount > 100000) {
          return { ok: false, error: "That is not a usable rate." };
        }
        await prisma.user.update({
          where: { id: user.id },
          data: { defaultRate: Math.round(fix.amount) } as unknown as Parameters<
            typeof prisma.user.update
          >[0]["data"],
        });
        break;
      }
      default:
        return { ok: false, error: "Nothing to change." };
    }

    revalidatePath("/home");
    revalidatePath("/memory");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't make that change." };
  }
}
