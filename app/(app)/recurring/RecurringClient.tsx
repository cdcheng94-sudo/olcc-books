"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, PauseCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLang } from "@/components/LangProvider";
import { fmtDate, fmtMoney } from "@/lib/format";
import { daysUntilDue, urgencyFor, daysLabel } from "@/lib/recurring-utils";
import type { RecurringRow } from "@/lib/types";
import { deleteRecurring, markRecurringPaid, updateRecurring } from "./actions";
import { RecurringFormModal } from "./RecurringFormModal";

export function RecurringClient({ initialRows }: { initialRows: RecurringRow[] }) {
  const { t } = useLang();
  const [rows, setRows] = useState<RecurringRow[]>(initialRows);
  const [editing, setEditing] = useState<RecurringRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function openNew()  { setEditing(null); setModalOpen(true); }
  function openEdit(row: RecurringRow) { setEditing(row); setModalOpen(true); }

  function onSaved(saved: RecurringRow) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) { const c = [...prev]; c[idx] = saved; return c; }
      return [saved, ...prev];
    });
    setModalOpen(false);
  }

  function onDelete(row: RecurringRow) {
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteRecurring(row.id);
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      } catch (e) { alert("Delete failed: " + (e as Error).message); }
    });
  }

  function onMarkPaid(row: RecurringRow) {
    if (!confirm(`Mark "${row.name}" as paid?\n\nThis records an expense transaction (MYR ${row.amount}) and advances the next due date by ${row.frequency}.`)) return;
    startTransition(async () => {
      try {
        const r = await markRecurringPaid(row.id);
        setRows((prev) => prev.map((x) => x.id === row.id ? { ...x, next_due_date: r.next_due_date, last_paid_date: new Date().toISOString().slice(0, 10) } : x));
      } catch (e) { alert("Failed: " + (e as Error).message); }
    });
  }

  function onToggleStatus(row: RecurringRow) {
    const newStatus = row.status === "active" ? "paused" : "active";
    startTransition(async () => {
      try {
        await updateRecurring(row.id, {
          name: row.name, payee: row.payee || undefined, amount: row.amount, category: row.category,
          frequency: row.frequency, next_due_date: row.next_due_date,
          remind_days_before: row.remind_days_before, status: newStatus,
        });
        setRows((prev) => prev.map((x) => x.id === row.id ? { ...x, status: newStatus } : x));
      } catch (e) { alert("Failed: " + (e as Error).message); }
    });
  }

  const activeRows = rows.filter((r) => r.status === "active");
  const pausedRows = rows.filter((r) => r.status === "paused");

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          {activeRows.length} active · {pausedRows.length} paused
        </div>
        <Button onClick={openNew} className="bg-navy hover:bg-navy-light text-white">
          <Plus className="w-4 h-4 mr-1" />
          {t.recurring.newRecurring}
        </Button>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">{t.recurring.name}</th>
              <th className="text-left px-4 py-3 font-medium">{t.recurring.payee}</th>
              <th className="text-left px-4 py-3 font-medium w-[140px]">Category</th>
              <th className="text-left px-4 py-3 font-medium w-[110px]">{t.recurring.frequency}</th>
              <th className="text-right px-4 py-3 font-medium w-[130px]">Amount</th>
              <th className="text-left px-4 py-3 font-medium w-[180px]">{t.recurring.nextDue}</th>
              <th className="text-left px-4 py-3 font-medium w-[90px]">Status</th>
              <th className="w-[160px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-muted-foreground italic py-12">{t.common.empty}</td></tr>
            ) : rows.map((r) => {
              const days = daysUntilDue(r.next_due_date);
              const u = urgencyFor(days);
              const dueColor =
                r.status !== "active"      ? "text-muted-foreground" :
                u === "overdue"            ? "text-[#7f1d1d] font-semibold" :
                u === "urgent"             ? "text-destructive font-semibold" :
                u === "caution"            ? "text-warning"                  :
                                              "text-success";
              return (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.payee || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.category}</td>
                  <td className="px-4 py-3 capitalize">{r.frequency}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(r.amount)}</td>
                  <td className="px-4 py-3">
                    <div>{fmtDate(r.next_due_date)}</div>
                    <div className={"text-xs " + dueColor}>{r.status === "active" ? daysLabel(days) : "(paused)"}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "active"
                      ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide bg-success-soft text-success">Active</span>
                      : <span className="inline-block px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide bg-muted text-muted-foreground">Paused</span>}
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <div className="flex items-center justify-end gap-0.5">
                      {r.status === "active" && (
                        <button onClick={() => onMarkPaid(r)} disabled={isPending} className="p-1.5 hover:bg-success/10 rounded text-muted-foreground hover:text-success" title="Mark paid">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => onToggleStatus(r)} disabled={isPending} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-navy" title={r.status === "active" ? "Pause" : "Activate"}>
                        {r.status === "active" ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-navy" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(r)} disabled={isPending} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-destructive" title="Delete">
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

      <RecurringFormModal open={modalOpen} onOpenChange={setModalOpen} editing={editing} onSaved={onSaved} />
    </div>
  );
}
