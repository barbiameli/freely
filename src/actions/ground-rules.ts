"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { track } from "@/lib/events";
import {
  GROUND_RULES,
  parseRuleSettings,
  type RuleKey,
  type RuleSettings,
} from "@/lib/ground-rules";

/** Reads an account's rule settings, with the starter set as the default. */
export async function currentRuleSettings(userId: string): Promise<RuleSettings> {
  // Selected wholesale rather than by column: groundRules is newer than the
  // generated client in some environments, and a named select would not
  // compile there. See the same pattern elsewhere in actions.
  const row = (await prisma.user.findUnique({
    where: { id: userId },
  })) as unknown as { groundRules?: unknown } | null;
  return parseRuleSettings(row?.groundRules);
}

/**
 * Switching one rule on or off.
 *
 * Per rule rather than a form with a save button: these are read one at a
 * time, thought about one at a time, and a page of preferences with a save
 * button at the bottom is a page where the save gets forgotten.
 */
export async function setRuleAction(
  key: string,
  on: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireFullUser();
    if (!GROUND_RULES.some((rule) => rule.key === key)) {
      return { ok: false, error: "That is not one of the rules." };
    }
    const settings = parseRuleSettings(
      (user as unknown as { groundRules?: unknown }).groundRules
    );
    const off = new Set<RuleKey>(settings.off);
    if (on) off.delete(key as RuleKey);
    else off.add(key as RuleKey);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        groundRules: {
          ...settings,
          off: Array.from(off),
        } as unknown as Prisma.InputJsonValue,
      } as unknown as Parameters<typeof prisma.user.update>[0]["data"],
    });

    // The rule key is a fixed name from the list above, never anything typed.
    track(on ? "rule_on" : "rule_off", { userId: user.id, detail: { rule: key } });
    revalidatePath("/rules");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that." };
  }
}

/**
 * One of the figures a rule states.
 *
 * Bounded per figure rather than by one global rule, since "days to pay" and
 * "percent up front" are not the same kind of number. Anything outside its
 * bounds is refused rather than clamped: silently turning 500 into 60 would
 * leave somebody believing their quotes say 500.
 */
export async function setRuleValueAction(
  key: string,
  amount: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireFullUser();
    const spec = GROUND_RULES.map((rule) => [rule.value, rule.extra])
      .flat()
      .find((value) => value?.key === key);
    if (!spec) return { ok: false, error: "That is not one of the figures." };
    if (!Number.isFinite(amount) || amount < spec.min || amount > spec.max) {
      return { ok: false, error: `Give a number between ${spec.min} and ${spec.max}.` };
    }

    const settings = parseRuleSettings(
      (user as unknown as { groundRules?: unknown }).groundRules
    );
    await prisma.user.update({
      where: { id: user.id },
      data: {
        groundRules: {
          ...settings,
          values: { ...settings.values, [spec.key]: Math.round(amount) },
        } as unknown as Prisma.InputJsonValue,
      } as unknown as Parameters<typeof prisma.user.update>[0]["data"],
    });
    revalidatePath("/rules");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that." };
  }
}
