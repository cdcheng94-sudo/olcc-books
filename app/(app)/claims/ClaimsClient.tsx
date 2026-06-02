"use client";

import { useState, useTransition, useMemo } from "react";
import { Plus, CheckCircle2, CircleCheck, Pencil, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLang } from "@/components/LangProvider";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { ClaimRow, ClaimStatus } from "@/lib/types";
import { deleteClaim, approveClaim, markClaimPaid } from "./actions";
import { ClaimFormModal } from "./ClaimFormModal";

type Filter = ClaimStatus | "all";

const STATUS_BADGE: Record<ClaimStatus, string> = {
  pending:  "bg-warning-soft text-warning",
  approved: "bg-accent text-navy",
  paid:     "bg-success-soft text-success",
};

export function ClaimsClient({ initialRows }: { initialRows: ClaimRow[] }) {
  const { t } = useLang();
  const [rows, setRows] = useState<ClaimRow[]>(initialRows);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<ClaimRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const visibleRows = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );
  const counts = useMemo(() => ({
    all:      rows.length,
    pending:  rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    paid:     rows.filter((r) => r.status === "paid").length,
  }), [rows]);

  function openNew()  { setEditing(null); setModalOpen(true); }
  function openEdit(row: ClaimRow) { setEditing(row); setModalOpen(true); }

  function onSaved(saved: ClaimRow) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) { const c = [...prev]; c[idx] = saved; return c; }
      return [saved, ...prev];
    });
    setModalOpen(false);
  }

  function onDelete(row: ClaimRow) {
    if (!confirm(`Delete claim "${row.item_desc}"${row.status === "paid" ? " — its expense transaction will also be removed" : ""}? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteClaim(row.id);
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      } catch (e) { alert("Delete failed: " + (e as Error).message); }
    });
  }

  function onApprove(row: ClaimRow) {
    if (!confirm(`Approve ${row.claimant}'s claim for ${fmtMoney(row.amount)}?`)) return;
    startTransition(async () => {
      try {
        await approveClaim(row.id);
        setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, status: "approved" } : r));
      } catch (e) { alert("Approve failed: " + (e as Error).message); }
    });
  }

  function onMarkPaid(row: ClaimRow) {
    if (!confirm(`Mark this claim paid? ${fmtMoney(row.amount)} will be recorded as an expense in /transactions.`)) return;
    startTransition(async () => {
      try {
        await markClaimPaid(row.id);
        const today = new Date().toISOString().slice(0, 10);
        setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, status: "paid", paid_date: today } : r));
      } catch (e) { alert("Mark paid failed: " + (e as Error).message); }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all","pending","approved","paid"] as Filter[]).map((f) => (
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
              {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)} · {counts[f]}
            </button>
          ))}
        </div>
        <Button onClick={openNew} className="bg-navy hover:bg-navy-light text-white">
          <Plus className="w-4 h-4 mr-1" />
          {t.claims.newClaim}
        </Button>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left  px-4 py-3 font-medium w-[110px]">Date</th>
              <th className="text-left  px-4 py-3 font-medium">{t.claims.claimant}</th>
              <th className="text-left  px-4 py-3 font-medium">{t.claims.item}</th>
              <th className="text-left  px-4 py-3 font-medium w-[110px]">Category</th>
              <th className="text-right px-4 py-3 font-medium w-[120px]">Amount</th>
              <th className="text-left  px-4 py-3 font-medium w-[100px]">{t.claims.status}</th>
              <th className="w-[170px]"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted-foreground italic py-12">{t.common.empty}</td></tr>
            ) : visibleRows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3">{fmtDate(r.date)}</td>
                <td className="px-4 py-3 font-medium">{r.claimant}</td>
                <td className="px-4 py-3">
                  <div>{r.item_desc}</div>
                  {r.receipt_url && (
                    <a href={r.receipt_url} target="_blank" rel="noreferrer" className="text-[11px] text-muted-foreground hover:text-navy underline inline-flex items-center gap-0.5">
                      receipt <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.category}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtMoney(r.amount)}</td>
                <td className="px-4 py-3">
                  <span className={"inline-block px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide " + STATUS_BADGE[r.status]}>
                    {r.status}
                  </span>
                </td>
                <td className="px-2 py-3 align-middle">
                  <div className="flex items-center justify-end gap-0.5">
                    {r.status === "pending" && (
                      <button onClick={() => onApprove(r)} disabled={isPending} className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-navy" title="Approve">
                        <CircleCheck className="w-4 h-4" />
                      </button>
                    )}
                    {r.status === "approved" && (
                      <button onClick={() => onMarkPaid(r)} disabled={isPending} className="p-1.5 hover:bg-success/10 rounded text-muted-foreground hover:text-success" title="Mark paid">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-navy" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete(r)} disabled={isPending} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-destructive" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ClaimFormModal open={modalOpen} onOpenChange={setModalOpen} editing={editing} onSaved={onSaved} />
    </div>
  );
}
