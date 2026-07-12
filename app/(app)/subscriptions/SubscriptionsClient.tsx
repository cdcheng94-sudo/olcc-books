"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, PauseCircle, PlayCircle, MessageCircle, Mail, FilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLang } from "@/components/LangProvider";
import { interp } from "@/lib/i18n";
import { fmtDate, fmtMoney } from "@/lib/format";
import { daysUntilDue, urgencyFor, localizedDaysLabel } from "@/lib/recurring-utils";
import type { SubscriptionRow } from "@/lib/types";
import { deleteSubscription, markSubscriptionPaid, updateSubscription, generateInvoiceForSubscription } from "./actions";
import { SubscriptionFormModal } from "./SubscriptionFormModal";

function whatsappLink(phone: string, message: string): string {
  const clean = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function SubscriptionsClient({ initialRows }: { initialRows: SubscriptionRow[] }) {
  const { t } = useLang();
  const [rows, setRows] = useState<SubscriptionRow[]>(initialRows);
  const [editing, setEditing] = useState<SubscriptionRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function openNew()  { setEditing(null); setModalOpen(true); }
  function openEdit(row: SubscriptionRow) { setEditing(row); setModalOpen(true); }

  function onSaved(saved: SubscriptionRow) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) { const c = [...prev]; c[idx] = saved; return c; }
      return [saved, ...prev];
    });
    setModalOpen(false);
  }

  function onDelete(row: SubscriptionRow) {
    if (!confirm(interp(t.subscriptions.confirmDelete, { name: row.customer_name }))) return;
    startTransition(async () => {
      try {
        await deleteSubscription(row.id);
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      } catch (e) { alert(t.errors.deleteFailed + (e as Error).message); }
    });
  }

  function onMarkPaid(row: SubscriptionRow) {
    const freqLabel = row.frequency === "monthly" ? t.common.monthly : row.frequency === "quarterly" ? t.common.quarterly : t.common.yearly;
    const netDue = +(row.amount * (1 - (row.discount_percent || 0) / 100)).toFixed(2);
    if (!confirm(interp(t.subscriptions.confirmMarkPaid, { amount: fmtMoney(netDue), freq: freqLabel }))) return;
    startTransition(async () => {
      try {
        const r = await markSubscriptionPaid(row.id);
        setRows((prev) => prev.map((x) => x.id === row.id
          ? { ...x, next_charge_date: r.next_charge_date, last_charged_date: new Date().toISOString().slice(0, 10) }
          : x));
      } catch (e) { alert(t.errors.failed + (e as Error).message); }
    });
  }

  function onToggleStatus(row: SubscriptionRow) {
    const newStatus = row.status === "active" ? "paused" : "active";
    startTransition(async () => {
      try {
        // pass every field through — otherwise validate() would reset
        // discount_percent / auto_invoice to their defaults on a status flip.
        await updateSubscription(row.id, {
          customer_name: row.customer_name, customer_email: row.customer_email || undefined,
          customer_phone: row.customer_phone || undefined, service_desc: row.service_desc,
          amount: row.amount, discount_percent: row.discount_percent, frequency: row.frequency,
          next_charge_date: row.next_charge_date, remind_days_before: row.remind_days_before,
          status: newStatus, auto_invoice: row.auto_invoice,
        });
        setRows((prev) => prev.map((x) => x.id === row.id ? { ...x, status: newStatus } : x));
      } catch (e) { alert(t.errors.failed + (e as Error).message); }
    });
  }

  function onGenInvoice(row: SubscriptionRow) {
    startTransition(async () => {
      try {
        const r = await generateInvoiceForSubscription(row.id);
        if (r.ok) {
          alert(interp(t.subscriptions.genInvoiceOk, { number: r.invoice_number || "" }));
          setRows((prev) => prev.map((x) => x.id === row.id ? { ...x, last_invoiced_date: x.next_charge_date } : x));
        } else if (r.already) {
          alert(t.subscriptions.genInvoiceAlready);
        }
      } catch (e) { alert(t.errors.failed + (e as Error).message); }
    });
  }

  const activeRows = rows.filter((r) => r.status === "active");
  const pausedRows = rows.filter((r) => r.status === "paused");

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          {interp(t.subscriptions.countLine, { active: activeRows.length, paused: pausedRows.length })}
        </div>
        <Button onClick={openNew} className="bg-navy hover:bg-navy-light text-white">
          <Plus className="w-4 h-4 mr-1" />
          {t.subscriptions.newSub}
        </Button>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">{t.subscriptions.customer}</th>
              <th className="text-left px-4 py-3 font-medium">{t.subscriptions.service}</th>
              <th className="text-left px-4 py-3 font-medium w-[110px]">{t.subscriptions.frequency}</th>
              <th className="text-right px-4 py-3 font-medium w-[130px]">{t.subscriptions.amount}</th>
              <th className="text-left px-4 py-3 font-medium w-[180px]">{t.subscriptions.nextCharge}</th>
              <th className="text-left px-4 py-3 font-medium w-[90px]">{t.subscriptions.status}</th>
              <th className="w-[200px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted-foreground italic py-12">{t.common.empty}</td></tr>
            ) : rows.map((r) => {
              const days = daysUntilDue(r.next_charge_date);
              const u = urgencyFor(days);
              const dueColor =
                r.status !== "active"      ? "text-muted-foreground" :
                u === "overdue"            ? "text-[#7f1d1d] font-semibold" :
                u === "urgent"             ? "text-destructive font-semibold" :
                u === "caution"            ? "text-warning"                  :
                                              "text-success";
              const netDue = +(r.amount * (1 - (r.discount_percent || 0) / 100)).toFixed(2);
              const reminderMsg = interp(t.subscriptions.waMessage, {
                name:    r.customer_name,
                service: r.service_desc,
                amount:  fmtMoney(netDue),
              });
              return (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.customer_name}</div>
                    {r.customer_email && <div className="text-xs text-muted-foreground">{r.customer_email}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.service_desc}</td>
                  <td className="px-4 py-3 capitalize">{r.frequency}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.discount_percent > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className="text-[11px] line-through text-muted-foreground">{fmtMoney(r.amount)}</span>
                        <span className="font-semibold">{fmtMoney(+(r.amount * (1 - r.discount_percent / 100)).toFixed(2))}</span>
                        <span className="text-[10px] text-destructive font-semibold">−{r.discount_percent}%</span>
                      </div>
                    ) : (
                      fmtMoney(r.amount)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>{fmtDate(r.next_charge_date)}</div>
                    <div className={"text-xs " + dueColor}>{r.status === "active" ? localizedDaysLabel(days, t) : t.subscriptions.paused}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "active"
                      ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide bg-success-soft text-success">{t.status.active}</span>
                      : <span className="inline-block px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide bg-muted text-muted-foreground">{t.status.paused}</span>}
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <div className="flex items-center justify-end gap-0.5">
                      {r.status === "active" && r.customer_phone && (
                        <a href={whatsappLink(r.customer_phone, reminderMsg)} target="_blank" rel="noreferrer"
                           className="p-1.5 hover:bg-success/10 rounded text-muted-foreground hover:text-success" title={t.subscriptions.tipWhatsApp}>
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                      {r.status === "active" && r.customer_email && (
                        <a href={`mailto:${r.customer_email}?subject=${encodeURIComponent(`Reminder: ${r.service_desc}`)}&body=${encodeURIComponent(reminderMsg)}`}
                           className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-navy" title={t.subscriptions.tipEmail}>
                          <Mail className="w-4 h-4" />
                        </a>
                      )}
                      {r.status === "active" && r.auto_invoice && (
                        <button onClick={() => onGenInvoice(r)} disabled={isPending} className="p-1.5 hover:bg-navy/10 rounded text-muted-foreground hover:text-navy" title={t.subscriptions.tipGenInvoice}>
                          <FilePlus className="w-4 h-4" />
                        </button>
                      )}
                      {r.status === "active" && !r.auto_invoice && (
                        <button onClick={() => onMarkPaid(r)} disabled={isPending} className="p-1.5 hover:bg-success/10 rounded text-muted-foreground hover:text-success" title={t.subscriptions.tipMarkPaid}>
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => onToggleStatus(r)} disabled={isPending} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-navy" title={r.status === "active" ? t.subscriptions.tipPause : t.subscriptions.tipActivate}>
                        {r.status === "active" ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-navy" title={t.subscriptions.tipEdit}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(r)} disabled={isPending} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-destructive" title={t.subscriptions.tipDelete}>
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

      <SubscriptionFormModal open={modalOpen} onOpenChange={setModalOpen} editing={editing} onSaved={onSaved} />
    </div>
  );
}
