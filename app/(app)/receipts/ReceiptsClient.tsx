"use client";

import { useState, useTransition } from "react";
import { Plus, FileDown, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLang } from "@/components/LangProvider";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { ReceiptRow } from "@/lib/types";
import { deleteReceipt, getReceiptDownloadUrl, emailReceipt } from "./actions";
import { ReceiptFormModal } from "./ReceiptFormModal";

export function ReceiptsClient({ initialRows }: { initialRows: ReceiptRow[] }) {
  const { t } = useLang();
  const [rows, setRows] = useState<ReceiptRow[]>(initialRows);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function openNew() { setModalOpen(true); }
  function onSaved(saved: ReceiptRow) {
    setRows((prev) => [saved, ...prev]);
    setModalOpen(false);
  }

  function onDelete(row: ReceiptRow) {
    if (!confirm(`Delete receipt ${row.receipt_number}? The linked income transaction will also be removed. This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteReceipt(row.id);
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      } catch (e) { alert("Delete failed: " + (e as Error).message); }
    });
  }

  function onDownload(row: ReceiptRow) {
    startTransition(async () => {
      try {
        const url = await getReceiptDownloadUrl(row.id);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) { alert("Download failed: " + (e as Error).message); }
    });
  }

  function onEmail(row: ReceiptRow) {
    if (!row.customer_email) { alert("This customer has no email. Edit the receipt to add one."); return; }
    if (!confirm(`Email receipt ${row.receipt_number} to ${row.customer_email}?`)) return;
    startTransition(async () => {
      try { await emailReceipt(row.id); alert("Sent ✓"); }
      catch (e) { alert("Send failed: " + (e as Error).message); }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          {rows.length} receipt{rows.length === 1 ? "" : "s"}
        </div>
        <Button onClick={openNew} className="bg-navy hover:bg-navy-light text-white">
          <Plus className="w-4 h-4 mr-1" />
          {t.receipt.newReceipt}
        </Button>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left  px-4 py-3 font-medium w-[140px]">{t.receipt.number}</th>
              <th className="text-left  px-4 py-3 font-medium">Customer</th>
              <th className="text-left  px-4 py-3 font-medium w-[120px]">Date</th>
              <th className="text-right px-4 py-3 font-medium w-[130px]">Total</th>
              <th className="text-left  px-4 py-3 font-medium w-[140px]">{t.receipt.paymentMethod}</th>
              <th className="w-[160px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground italic py-12">{t.common.empty}</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-mono font-medium">{r.receipt_number}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.customer_name}</div>
                  {r.customer_email && <div className="text-xs text-muted-foreground">{r.customer_email}</div>}
                </td>
                <td className="px-4 py-3">{fmtDate(r.date)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-success">{fmtMoney(r.total)}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.payment_method}</td>
                <td className="px-2 py-3 align-middle">
                  <div className="flex items-center justify-end gap-0.5">
                    <button onClick={() => onDownload(r)} disabled={isPending} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-navy" title="Download PDF">
                      <FileDown className="w-4 h-4" />
                    </button>
                    {r.customer_email && (
                      <button onClick={() => onEmail(r)} disabled={isPending} className="p-1.5 hover:bg-warning-soft rounded text-muted-foreground hover:text-warning" title="Email receipt">
                        <Send className="w-4 h-4" />
                      </button>
                    )}
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

      <ReceiptFormModal open={modalOpen} onOpenChange={setModalOpen} onSaved={onSaved} />
    </div>
  );
}
