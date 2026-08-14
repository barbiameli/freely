"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { FreelyLogo } from "@/components/freely-logo";
import { unsubscribeAction } from "@/actions/marketing";
import { useT } from "@/lib/i18n/context";

/**
 * Unsubscribing, without signing in.
 *
 * One click and it is done. No sign-in, no "are you sure", no survey asking why:
 * somebody here has decided, and an extra step is a way of not accepting that.
 *
 * It reports the same thing for a token it does not recognise. A page that says
 * "no such subscriber" is a way to test whether an address is on the list, and
 * the person clicking wanted to stop hearing from us either way.
 */
export default function UnsubscribePage({ params }: { params: { token: string } }) {
  const t = useT();
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    unsubscribeAction(params.token).then(() => {
      if (!cancelled) setDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-5 py-10">
      <Card className="w-full max-w-sm">
        <div className="mb-1">
          <FreelyLogo />
        </div>
        <p className="text-slate text-sm mt-4 mb-1">
          {done ? t.auth.unsubscribedTitle : t.common.loading}
        </p>
        {done && (
          <>
            <p className="text-text-muted text-xs mb-5">{t.auth.unsubscribedBody}</p>
            <Link href="/" className="text-violet text-xs font-semibold no-underline">
              {t.auth.backToFreely}
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
