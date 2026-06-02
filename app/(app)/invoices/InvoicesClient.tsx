"use client";

import { useState, useTransition, useMemo } from "react";
import { Plus, FileDown, Send, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLang } from "@/components/LangProvider";
import { interp } from "@/lib/i18n";
import { fmtDate, fmtMoney } from "@/lib/format";
import { daysUntilDue } from "@/lib/recurring-utils";
import { PAYMENT_METHODS } from "@/lib/categories";
import type { InvoiceRow, InvoiceStatus } from "@/lib/types";
import {
  deleteInvoice,
  getInvoiceDownloadUrl,
  sendInvoiceByEmail,
  markInvoicePaid,
} from "./actions";
import { InvoiceFormModal } from "./InvoiceFormModal";

type Filter = InvoiceStatus | "all";

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent:  "bg-warning-soft text-warning",
  paid:  "bg-success-soft text-success",
};

export function InvoicesClient({ initialRows }: { initialRows: InvoiceRow[] }) {
  const { t } = useLang();
  const [rows, setRows] = useState<InvoiceRow[]>(initialRows);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<InvoiceRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const visibleRows = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  const counts = useMemo(() => ({
    all:    rows.length,
    draft:  rows.filter((r) => r.status === "draft").length,
    sent:   rows.filter((r) => r.status === "sent").length,
    paid:   rows.filter((r) => r.status === "paid").length,
  }), [rows]);

  const filterLabel: Record<Filter, string> = {
    all:   t.invoice.filterAll,
    draft: t.invoice.filterDraft,
    sent:  t.invoice.filterSent,
    paid:  t.invoice.filterPaid,
  };

  const statusLabel: Record<InvoiceStatus, string> = {
    draft: t.status.draft,
    sent:  t.status.sent,
    paid:  t.status.paid,
  };

  function openNew()  { setEditing(null); setModalOpen(true); }
  function openEdit(row: InvoiceRow) { setEditing(row); setModalOpen(true); }

  function onSaved(saved: InvoiceRow) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) { const c = [...prev]; c[idx] = saved; return c; }
      return [saved, ...prev];
    });
    setModalOpen(false);
  }

  function onDelete(row: InvoiceRow) {
    const msg = row.status === "draft"
      ? interp(t.invoice.confirmDelDraft, { number: row.invoice_number })
      : interp(t.invoice.confirmDelSent,  { number: row.invoice_number, status: statusLabel[row.status] });
    if (!confirm(msg)) return;
    startTransition(async () => {
      try {
        await deleteInvoice(row.id);
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      } catch (e) { alert(t.errors.deleteFailed + (e as Error).message); }
    });
  }

  function onDownload(row: InvoiceRow) {
    startTransition(async () => {
      try {
        const url = await getInvoiceDownloadUrl(row.id);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) { alert(t.errors.downloadFailed + (e as Error).message); }
    });
  }

  function onSendEmail(row: InvoiceRow) {
    if (!row.customer_email) { alert(t.common.noEmail); return; }
    if (!confirm(interp(t.invoice.confirmSend, { number: row.invoice_number, email: row.customer_email }))) return;
    startTransition(async () => {
      try {
        await sendInvoiceByEmail(row.id);
        setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, status: r.status === "draft" ? "sent" : r.status } : r));
        alert(t.invoice.sentOk);
      } catch (e) { alert(t.errors.sendFailed + (e as Error).message); }
    });
  }

  function onMarkPaid(row: InvoiceRow) {
    const method = prompt(
      interp(t.invoice.markPaidPrompt, {
        number:  row.invoice_number,
        amount:  fmtMoney(row.total),
        methods: PAYMENT_METHODS.join(", "),
      }),
      "Bank Transfer",
    );
    if (!method) return;
    if (!PAYMENT_METHODS.includes(method as never)) { alert(t.invoice.markPaidUnknown); return; }
    startTransition(async () => {
      try {
        await markInvoicePaid(row.id, method);
        setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, status: "paid" } : r));
        alert(t.invoice.markPaidOk);
      } catch (e) { alert(t.errors.markPaidFailed + (e as Error).message); }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all","draft","sent","paid"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " +
                (filter === f
                  ? "bg-navy text-white border-navy"
                  : "bg-card text-muted-foreground border-border hover:text-navy")
              }
            >
              {filterLabel[f]} · {counts[f]}
            </button>
          ))}
        </div>
        <Button onClick={openNew} className="bg-navy hover:bg-navy-light text-white">
          <Plus className="w-4 h-4 mr-1" />
          {t.invoice.newInvoice}
        </Button>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium w-[140px]">{t.invoice.number}</th>
              <th className="text-left px-4 py-3 font-medium">{t.invoice.customer}</th>
              <th className="text-left px-4 py-3 font-medium w-[120px]">{t.invoice.dueDate}</th>
              <th className="text-right px-4 py-3 font-medium w-[130px]">{t.invoice.total}</th>
              <th className="text-left px-4 py-3 font-medium w-[90px]">{t.invoice.status}</th>
              <th className="w-[200px]"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground italic py-12">{t.common.empty}</td></tr>
            ) : visibleRows.map((r) => {
              const days = daysUntilDue(r.due_date);
              const overdue = r.status !== "paid" && days < 0;
              return (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono font-medium">{r.invoice_number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.customer_name}</div>
                    {r.customer_email && <div className="text-xs text-muted-foreground">{r.customer_email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div>{fmtDate(r.due_date)}</div>
                    {overdue && <div className="text-[11px] text-destructive font-semibold">{Math.abs(days)}{t.invoice.daysOverdueSuffix}</div>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtMoney(r.total)}</td>
                  <td className="px-4 py-3">
                    <span className={"inline-block px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide " + STATUS_BADGE[r.status]}>
                      {statusLabel[r.status]}
                    </span>
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => onDownload(r)} disabled={isPending} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-navy" title={t.invoice.tipDownloadPdf}>
                        <FileDown className="w-4 h-4" />
                      </button>
                      {r.status !== "paid" && r.customer_email && (
                        <button onClick={() => onSendEmail(r)} disabled={isPending} className="p-1.5 hover:bg-warning-soft rounded text-muted-foreground hover:text-warning" title={t.invoice.tipSendEmail}>
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {r.status !== "paid" && (
                        <button onClick={() => onMarkPaid(r)} disabled={isPending} className="p-1.5 hover:bg-success/10 rounded text-muted-foreground hover:text-success" title={t.invoice.tipMarkPaid}>
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-navy" title={t.invoice.tipEdit}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(r)} disabled={isPending} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-destructive" title={t.invoice.tipDelete}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <InvoiceFormModal open={modalOpen} onOpenChange={setModalOpen} editing={editing} onSaved={onSaved} />
    </div>
  );
}
