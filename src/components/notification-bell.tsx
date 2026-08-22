"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  notificationsAction,
  markNotificationsReadAction,
} from "@/actions/notifications";
import { Popover, PopoverHeader, PopoverList } from "@/components/ui/popover";
import { badge, type NotificationRow } from "@/lib/notify";
import { formatDay } from "@/lib/schedule";
import { useT, useLocale } from "@/lib/i18n/context";

/**
 * The bell.
 *
 * It shows the things that happened while somebody was not looking: a client
 * accepting a quote, an invoice being paid, a date passing. The same events
 * that send an email, so the two agree, and somebody who turned emails off
 * still has somewhere to find out.
 *
 * Loaded when it is opened rather than on every page. A count fetched on every
 * navigation is a query per page load in exchange for a number that is almost
 * always zero, and the number of unread items does not change while somebody
 * reads a page.
 *
 * Opening it marks everything read. Asking somebody to dismiss each line after
 * they have read the list is asking them to do the same job twice.
 */
export function NotificationBell() {
  const t = useT();
  const locale = useLocale();
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [unread, setUnread] = useState(0);

  // The count once, on mount, so the bell is honest before it is opened.
  useEffect(() => {
    let alive = true;
    void notificationsAction().then((result) => {
      if (alive && result.ok) setUnread(result.data.unread);
    });
    return () => {
      alive = false;
    };
  }, []);


  /** Loads on open, and opening is reading. */
  async function load() {
    const result = await notificationsAction();
    if (result.ok) setItems(result.data.items);
    // Cleared straight away so the badge agrees with what is on screen, and
    // recorded in the background.
    setUnread(0);
    void markNotificationsReadAction();
  }

  const count = badge(unread);

  return (
    <Popover
      label={t.notifications.title}
      align="right"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={() => {
            if (!open) void load();
            toggle();
          }}
          aria-label={t.notifications.title}
          aria-expanded={open}
          className="relative flex items-center justify-center w-9 h-9 rounded-full text-slate hover:text-ink hover:bg-paper bg-none border-none cursor-pointer tap transition-colors"
        >
          <Bell size={16} />
          {count && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-coral text-white font-body font-bold text-[10px] leading-4 text-center">
              {count}
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <>
          <PopoverHeader title={t.notifications.title} />
          <PopoverList>
            {items === null ? (
              <div className="px-4 py-6 text-small text-text-muted">{t.common.loading}</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6">
                <p className="text-small text-ink m-0">{t.notifications.emptyTitle}</p>
                <p className="text-meta text-text-muted mt-1 mb-0 text-pretty">
                  {t.notifications.emptyBody}
                </p>
              </div>
            ) : (
              items.map((item) => {
                const inner = (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-body font-semibold text-small text-ink text-pretty">
                        {item.title}
                      </span>
                      <span className="text-caption text-text-muted shrink-0 tabular-nums">
                        {formatDay(new Date(item.createdAt), locale === "es" ? "es-ES" : "en-GB")}
                      </span>
                    </div>
                    <p className="text-meta text-slate mt-0.5 mb-0 text-pretty">{item.body}</p>
                  </>
                );
                return item.href ? (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={close}
                    className="block px-4 py-3 border-b border-line/70 last:border-b-0 no-underline hover:bg-paper transition-colors"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={item.id} className="px-4 py-3 border-b border-line/70 last:border-b-0">
                    {inner}
                  </div>
                );
              })
            )}
          </PopoverList>
        </>
      )}
    </Popover>
  );
}
