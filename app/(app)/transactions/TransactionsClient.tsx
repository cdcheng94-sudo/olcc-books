"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, ScanLine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLang } from "@/components/LangProvider";
import { fmtDate, fmtMoney, isoMonth } from "@/lib/format";
import { CATEGORIES } from "@/lib/categories";
import type { TransactionRow } from "@/lib/types";
import { deleteTransaction } from "./actions";
import { TransactionFormModal, type TxPrefill } from "./TransactionFormModal";

type Filters = {
  yearMonth: string;        // "" means All time
  type:      "" | "income" | "expense";
  category:  string;
};

const NO_MONTH = "" as const;

export function TransactionsClient({ initialRows }: { initialRows: TransactionRow[] }) {
  const { t } = useLang();
  const [rows, setRows] = useState<TransactionRow[]>(initialRows);
  const [filters, setFilters] = useState<Filters>({
    yearMonth: isoMonth(),
    type: "",
    category: "",
  });
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [prefill, setPrefill] = useState<TxPrefill | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [scanning, setScanning] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Re-fetch rows whenever filters change. Client-side query against Supabase
  // (RLS allows authenticated users to read).
  useEffect(() => {
    const supabase = createClient();
    let q = supabase.from("transactions").select("*").order("date", { ascending: false });

    if (filters.yearMonth) {
      const [y, m] = filters.yearMonth.split("-").map(Number);
      const start = `${filters.yearMonth}-01`;
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      q = q.gte("date", start).lt("date", next);
    }
    if (filters.type)     q = q.eq("type", filters.type);
    if (filters.category) q = q.eq("category", filters.category);

    q.then(({ data, error }) => {
      if (!error && data) setRows(data as TransactionRow[]);
    });
  }, [filters]);

  function openNew() {
    setEditing(null);
    setPrefill(null);
    setModalOpen(true);
  }

  function openEdit(row: TransactionRow) {
    setEditing(row);
    setPrefill(null);
    setModalOpen(true);
  }

  function pickScanFile() {
    scanInputRef.current?.click();
  }

  async function onScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";   // reset so picking the same file again re-fires
    if (!f) return;
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/ocr/parse-receipt", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Scan failed");
      setEditing(null);
      setPrefill(json.parsed as TxPrefill);
      setModalOpen(true);
    } catch (err) {
      alert(t.errors.scanFailed + (err as Error).message);
    } finally {
      setScanning(false);
    }
  }

  function onSaved(saved: TransactionRow) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      // New row — prepend (latest first)
      return [saved, ...prev];
    });
    setModalOpen(false);
  }

  function onDelete(row: TransactionRow) {
    if (!confirm(t.tx.confirmDeleteTx)) return;
    startTransition(async () => {
      try {
        await deleteTransaction(row.id);
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      } catch (e) {
        alert(t.errors.deleteFailed + (e as Error).message);
      }
    });
  }

  const categoryChoices =
    filters.type === "income"  ? CATEGORIES.income :
    filters.type === "expense" ? CATEGORIES.expense :
    [...CATEGORIES.income, ...CATEGORIES.expense];

  return (
    <div>
      {/* header row */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? t.common.entry : t.common.entries}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={scanInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onScanFile}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={pickScanFile}
            disabled={scanning}
            className="border-gold text-navy hover:bg-gold/10"
          >
            <ScanLine className="w-4 h-4 mr-1" />
            {scanning ? t.tx.scanning : t.tx.scanReceipt}
          </Button>
          <Button onClick={openNew} className="bg-navy hover:bg-navy-light text-white">
            <Plus className="w-4 h-4 mr-1" />
            {t.tx.newBoth}
          </Button>
        </div>
      </div>

      {/* filters */}
      <Card className="p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>{t.tx.filterMonth}</span>
            <input
              type="month"
              value={filters.yearMonth}
              onChange={(e) => setFilters((f) => ({ ...f, yearMonth: e.target.value }))}
              className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>{t.tx.filterType}</span>
            <select
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as Filters["type"], category: "" }))}
              className="border border-border rounded-md px-3 py-1.5 text-sm bg-background min-w-[120px]"
            >
              <option value="">{t.tx.filterAllType}</option>
              <option value="income">{t.tx.income}</option>
              <option value="expense">{t.tx.expense}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>{t.tx.filterCategory}</span>
            <select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              className="border border-border rounded-md px-3 py-1.5 text-sm bg-background min-w-[160px]"
            >
              <option value="">{t.tx.filterAllCat}</option>
              {categoryChoices.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ yearMonth: NO_MONTH, type: "", category: "" })}
            className="text-muted-foreground"
          >
            {t.tx.showOlder}
          </Button>
        </div>
      </Card>

      {/* table */}
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium w-[110px]">{t.tx.date}</th>
              <th className="text-left px-4 py-3 font-medium w-[90px]">{t.tx.type}</th>
              <th className="text-left px-4 py-3 font-medium">{t.tx.category}</th>
              <th className="text-right px-4 py-3 font-medium w-[140px]">{t.tx.amount}</th>
              <th className="text-left px-4 py-3 font-medium">{t.tx.party}</th>
              <th className="text-left px-4 py-3 font-medium">{t.tx.note}</th>
              <th className="text-left px-4 py-3 font-medium w-[80px]">{t.tx.receipt}</th>
              <th className="w-[100px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-muted-foreground italic py-12">
                  {t.common.empty}
                </td>
              </tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="px-4 py-3">
                  <span className={
                    "inline-block px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide " +
                    (r.type === "income" ? "bg-success-soft text-success" : "bg-danger-soft text-danger")
                  }>
                    {r.type === "income" ? t.tx.income : t.tx.expense}
                  </span>
                </td>
                <td className="px-4 py-3">{r.category}</td>
                <td className={
                  "px-4 py-3 text-right whitespace-nowrap font-semibold tabular-nums " +
                  (r.type === "income" ? "text-success" : "text-danger")
                }>
                  {r.type === "income" ? "+ " : "− "}{fmtMoney(r.amount)}
                </td>
                <td className="px-4 py-3">{r.party || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.note || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3">
                  {r.receipt_url ? (
                    <a href={r.receipt_url} target="_blank" rel="noreferrer" className="text-navy hover:text-gold underline">View</a>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-2 py-3 text-right">
                  <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-navy" title={t.common.edit}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(r)} disabled={isPending} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-destructive" title={t.common.delete}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <TransactionFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
        prefill={prefill}
        onSaved={onSaved}
      />
    </div>
  );
}
