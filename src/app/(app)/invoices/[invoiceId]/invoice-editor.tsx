"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Trash2, Check, Plus, ShieldOff } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CURRENCIES, currencySymbol } from "@/lib/currencies";
import { BRANDING_OPTIONS } from "@/lib/branding";
import { updateInvoiceAction, deleteInvoiceAction, type InvoicePatch } from "@/actions/invoices";
import type { InvoiceLineItem } from "@/lib/invoice-pdf";

interface EditorInvoice {
  id: string;
  number: number;
  issuedAt: string;
  dueAt: string;
  reference: string;
  clientName: string;
  clientCompany: string;
  clientWebsite: string;
  clientEmail: string;
  fromName: string;
  fromTagline: string;
  fromWebsite: string;
  fromEmail: string;
  fromAddress: string;
  lineItems: InvoiceLineItem[];
  currency: string;
  taxRate: number;
  notes: string;
  branding: string;
  paid: boolean;
}

/**
 * Where payment details are remembered, when the user opts in.
 *
 * localStorage, so they stay on this device and never reach our server or
 * database. That keeps the promise on the form honest while sparing people
 * from retyping an IBAN every month, where one wrong digit means a payment
 * that bounces or goes astray. Off by default.
 */
const PAYMENT_STORAGE_KEY = "freely.invoice.payment";

/** A section heading that states whether the section is needed, as plain
 * text. Badges here read as chips, which look tappable and are not. */
function SectionHeading({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <Label>{children}</Label>
      <span className="text-[11px] text-text-muted">{required ? "Required" : "Optional"}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}) {
  const shared =
    "w-full font-body text-[13px] text-ink bg-paper border border-line rounded-lg px-2.5 py-2 outline-none";
  return (
    <label className="block">
      <span className="block text-[10.5px] font-bold text-slate uppercase tracking-wide mb-1">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className={shared}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          className={shared}
        />
      )}
    </label>
  );
}

export function InvoiceEditor({
  invoice,
  hasBrand,
}: {
  invoice: EditorInvoice;
  hasBrand?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(invoice);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  // Never sent to the server except in the body of the download request, and
  // never stored there.
  const [paymentBlock, setPaymentBlock] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PAYMENT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { block?: string; note?: string };
        setPaymentBlock(parsed.block || "");
        setPaymentNote(parsed.note || "");
        setRemember(true);
      }
    } catch {
      // A malformed or unavailable store just means an empty form.
    }
  }, []);

  function set<K extends keyof EditorInvoice>(key: K, value: EditorInvoice[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(patch?: InvoicePatch) {
    setSaving(true);
    setError("");
    const result = await updateInvoiceAction(invoice.id, patch ?? {
      reference: form.reference,
      clientName: form.clientName,
      clientCompany: form.clientCompany,
      clientWebsite: form.clientWebsite,
      clientEmail: form.clientEmail,
      fromName: form.fromName,
      fromTagline: form.fromTagline,
      fromWebsite: form.fromWebsite,
      fromEmail: form.fromEmail,
      fromAddress: form.fromAddress,
      currency: form.currency,
      taxRate: form.taxRate,
      notes: form.notes,
      branding: form.branding,
      issuedAt: form.issuedAt,
      dueAt: form.dueAt,
      lineItems: form.lineItems,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }

  async function download() {
    if (!paymentBlock.trim()) {
      setError("Add your payment details first. They go into the PDF and aren't stored.");
      return;
    }
    setDownloading(true);
    setError("");

    // Save the invoice itself first, so the PDF matches what's on screen.
    const saved = await save();
    if (!saved) {
      setDownloading(false);
      return;
    }

    if (remember) {
      localStorage.setItem(
        PAYMENT_STORAGE_KEY,
        JSON.stringify({ block: paymentBlock, note: paymentNote })
      );
    } else {
      localStorage.removeItem(PAYMENT_STORAGE_KEY);
    }

    try {
      // POST, not GET: payment details in a query string would end up in
      // access logs and browser history.
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentBlock, paymentNote }),
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({ error: "Couldn't build the PDF." }));
        setError(problem.error || "Couldn't build the PDF.");
        setDownloading(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${String(invoice.number).padStart(4, "0")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't build the PDF. Try again.");
    }
    setDownloading(false);
  }

  const subtotal = form.lineItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const total = subtotal * (1 + (Number(form.taxRate) || 0) / 100);
  const symbol = currencySymbol(form.currency);

  return (
    <>
      <Topbar eyebrow={`Invoice #${String(invoice.number).padStart(4, "0")}`} />

      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="font-display italic text-[30px] md:text-4xl text-coral m-0">
            Invoice #{String(invoice.number).padStart(4, "0")}
          </h1>
          <p className="text-slate text-[15px] mt-2">
            {form.paid ? "Marked as paid." : "Not paid yet."}{" "}
            <Link href="/invoices" className="text-violet font-semibold">
              All invoices
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            icon={Check}
            onClick={async () => {
              const next = !form.paid;
              set("paid", next);
              await save({ paid: next });
            }}
          >
            {form.paid ? "Mark unpaid" : "Mark paid"}
          </Button>
          <Button icon={Download} disabled={downloading} onClick={download}>
            {downloading ? "Building..." : "Download PDF"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-5">
        <Card className="flex-1">
          <SectionHeading required>From</SectionHeading>
          <div className="flex flex-col gap-2.5 mt-1">
            <Field label="Name" value={form.fromName} onChange={(v) => set("fromName", v)} />
            <Field
              label="Disciplines line"
              value={form.fromTagline}
              onChange={(v) => set("fromTagline", v)}
              placeholder="UX design · Product design · CRO"
            />
            <Field label="Website" value={form.fromWebsite} onChange={(v) => set("fromWebsite", v)} />
            <Field label="Email" value={form.fromEmail} onChange={(v) => set("fromEmail", v)} />
            <Field
              label="Location"
              value={form.fromAddress}
              onChange={(v) => set("fromAddress", v)}
              placeholder="Valencia, Spain"
            />
          </div>
        </Card>

        <Card className="flex-1">
          <SectionHeading required>Billed to</SectionHeading>
          <div className="flex flex-col gap-2.5 mt-1">
            <Field label="Name" value={form.clientName} onChange={(v) => set("clientName", v)} />
            <Field
              label="Company"
              value={form.clientCompany}
              onChange={(v) => set("clientCompany", v)}
            />
            <Field
              label="Website"
              value={form.clientWebsite}
              onChange={(v) => set("clientWebsite", v)}
            />
            <Field label="Email" value={form.clientEmail} onChange={(v) => set("clientEmail", v)} />
            <Field
              label="Reference"
              value={form.reference}
              onChange={(v) => set("reference", v)}
              placeholder="INV-0001 / Client"
            />
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeading required>Dates and currency</SectionHeading>
        <div className="flex gap-4 mt-1">
          <div className="flex-1">
            <Field label="Issued" type="date" value={form.issuedAt} onChange={(v) => set("issuedAt", v)} />
          </div>
          <div className="flex-1">
            <Field label="Due" type="date" value={form.dueAt} onChange={(v) => set("dueAt", v)} />
          </div>
          <label className="block flex-1">
            <span className="block text-[10.5px] font-bold text-slate uppercase tracking-wide mb-1">
              Currency
            </span>
            <select
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
              className="w-full bg-paper rounded-lg border border-line px-2.5 py-2 text-[13px] text-ink outline-none cursor-pointer"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </label>
          <div className="flex-1">
            <Field
              label="Tax %"
              type="number"
              value={String(form.taxRate)}
              onChange={(v) => set("taxRate", Number(v) || 0)}
            />
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeading required>Line items</SectionHeading>
        <div className="flex flex-col gap-3 mt-1">
          {form.lineItems.map((item, i) => (
            <div key={i} className="bg-paper rounded-lg p-3">
              <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-start">
                <div className="flex-1 flex flex-col gap-2">
                  <input
                    value={item.title}
                    onChange={(e) =>
                      set(
                        "lineItems",
                        form.lineItems.map((l, j) =>
                          j === i ? { ...l, title: e.target.value } : l
                        )
                      )
                    }
                    placeholder="What this covers"
                    className="w-full font-body font-semibold text-[13px] text-ink bg-white border border-line rounded-lg px-2.5 py-2 outline-none"
                  />
                  <textarea
                    value={item.description || ""}
                    onChange={(e) =>
                      set(
                        "lineItems",
                        form.lineItems.map((l, j) =>
                          j === i ? { ...l, description: e.target.value } : l
                        )
                      )
                    }
                    placeholder="A sentence of detail, optional"
                    rows={2}
                    className="w-full font-body text-[12.5px] text-slate bg-white border border-line rounded-lg px-2.5 py-2 outline-none"
                  />
                </div>
                <div className="flex flex-row md:flex-col gap-2 md:w-[92px]">
                  <input
                    value={item.rate ?? ""}
                    onChange={(e) =>
                      set(
                        "lineItems",
                        form.lineItems.map((l, j) =>
                          j === i ? { ...l, rate: e.target.value === "" ? null : Number(e.target.value) } : l
                        )
                      )
                    }
                    placeholder="Rate"
                    type="number"
                    className="w-full font-body text-[12.5px] text-ink bg-white border border-line rounded-lg px-2 py-2 outline-none"
                  />
                  <input
                    value={item.hours ?? ""}
                    onChange={(e) =>
                      set(
                        "lineItems",
                        form.lineItems.map((l, j) =>
                          j === i ? { ...l, hours: e.target.value === "" ? null : Number(e.target.value) } : l
                        )
                      )
                    }
                    placeholder="Hours"
                    type="number"
                    className="w-full font-body text-[12.5px] text-ink bg-white border border-line rounded-lg px-2 py-2 outline-none"
                  />
                </div>
                <div className="md:w-[110px]">
                  <input
                    value={item.amount}
                    onChange={(e) =>
                      set(
                        "lineItems",
                        form.lineItems.map((l, j) =>
                          j === i ? { ...l, amount: Number(e.target.value) || 0 } : l
                        )
                      )
                    }
                    placeholder="Amount"
                    type="number"
                    className="w-full font-body font-bold text-[13px] text-ink bg-white border border-line rounded-lg px-2 py-2 outline-none"
                  />
                  {item.rate && item.hours ? (
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "lineItems",
                          form.lineItems.map((l, j) =>
                            j === i ? { ...l, amount: (l.rate || 0) * (l.hours || 0) } : l
                          )
                        )
                      }
                      className="text-[11px] text-violet font-bold bg-none border-none cursor-pointer p-0 mt-1"
                    >
                      = {symbol}
                      {((item.rate || 0) * (item.hours || 0)).toLocaleString()}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "lineItems",
                      form.lineItems.filter((_, j) => j !== i)
                    )
                  }
                  className="text-text-muted hover:text-overdue bg-none border-none cursor-pointer p-1 mt-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              set("lineItems", [
                ...form.lineItems,
                { title: "", description: "", rate: null, hours: null, amount: 0 },
              ])
            }
            className="flex items-center gap-1.5 font-body font-bold text-[12.5px] text-violet bg-none border-none cursor-pointer p-0 self-start"
          >
            <Plus size={13} /> Add a line
          </button>
        </div>

        <div className="flex flex-wrap justify-start md:justify-end gap-4 md:gap-8 mt-4 pt-4 border-t border-line">
          <span className="text-[13px] text-slate">
            Subtotal {symbol}
            {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className="font-body font-bold text-[15px] text-ink">
            Total due {symbol}
            {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      </Card>

      <Card>
        <SectionHeading>Branding</SectionHeading>
        <p className="text-xs text-text-muted mb-3">
          Defaults to whatever the matching quote used.
        </p>
        <div className="flex gap-2.5 flex-wrap">
          {BRANDING_OPTIONS.map((opt) => {
            const disabled = opt.id === "own" && !hasBrand;
            return (
              <Chip
                key={opt.id}
                active={form.branding === opt.id}
                onClick={disabled ? undefined : () => set("branding", opt.id)}
              >
                {opt.name}
                {disabled ? " (add branding first)" : ""}
              </Chip>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionHeading>Closing note</SectionHeading>
        <div className="mt-1">
          <Field
            label="Shown at the foot of the invoice"
            value={form.notes}
            onChange={(v) => set("notes", v)}
            multiline
          />
        </div>
      </Card>

      {/* Payment details: the one part of this page that is never stored. */}
      <Card className="border-violet border-[1.5px]">
        <div className="flex items-start gap-2 mb-1">
          <ShieldOff size={15} className="text-violet shrink-0 mt-0.5" />
          <div>
            <SectionHeading required>Payment details</SectionHeading>
            <p className="text-[12.5px] text-slate mt-1 mb-0">
              These go into the PDF and are not saved to your Freely account.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 mt-3">
          <Field
            label="Details as they should appear"
            value={paymentBlock}
            onChange={setPaymentBlock}
            placeholder={"Account name\nBank\nAccount identifier"}
            multiline
          />
          {/* Free text, not structured fields: what a client needs to pay you
              differs by country, so any fixed set of inputs would be wrong for
              most people. */}
          <p className="text-[11.5px] text-text-muted m-0 -mt-1">
            Whatever your bank actually needs, typed exactly as it should print. IBAN and BIC or
            SWIFT across the EU, sort code and account number in the UK, routing and account number
            in the US, CLABE in Mexico, and so on. Include the account name, since some banks
            reject a transfer without it.
          </p>
          <Field
            label="Extra line, optional"
            value={paymentNote}
            onChange={setPaymentNote}
            placeholder="e.g. full details on request, or a payment link"
          />
          <label className="flex items-start gap-2.5 text-[12.5px] text-slate cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="mt-0.5 shrink-0"
            />
            <span>Remember these on this device, so I do not retype them next time.</span>
          </label>
        </div>
      </Card>

      {error && <div className="text-overdue text-[13px]">{error}</div>}

      <div className="flex flex-col-reverse md:flex-row md:justify-between md:items-center gap-4">
        <button
          type="button"
          onClick={async () => {
            const result = await deleteInvoiceAction(invoice.id);
            if (result.ok) router.push("/invoices");
            else setError(result.error);
          }}
          className="text-[12.5px] text-text-muted hover:text-overdue underline bg-none border-none cursor-pointer p-0"
        >
          Delete this invoice
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={saving} onClick={() => save()}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button icon={Download} disabled={downloading} onClick={download}>
            {downloading ? "Building..." : "Download PDF"}
          </Button>
        </div>
      </div>
    </>
  );
}
