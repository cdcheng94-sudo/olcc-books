"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, ScanLine, Upload, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLang } from "@/components/LangProvider";
import { fmtDate, fmtMoney, isoMonth } from "@/lib/format";
import { TRANSACTION_TYPES, CAPITAL_CATEGORIES, CAPITAL_TYPES, INFLOW_TYPES, type TransactionType } from "@/lib/categories";
import type { TransactionRow, ShareholderRow } from "@/lib/types";
import { deleteTransaction } from "./actions";
import { TransactionFormModal, type TxPrefill } from "./TransactionFormModal";
import { uploadReceiptToDrive } from "@/lib/upload-receipt";

const driveCategoryFor = (ty: TransactionType): "Receipts" | "Capital" =>
  (CAPITAL_TYPES as readonly string[]).includes(ty) ? "Capital" : "Receipts";

type Props = {
  initialRows: TransactionRow[];
  shareholders: ShareholderRow[];
  outstandingMap: Record<string, number>;
  shareholderNames: Record<string, string>;
};

// 6-type badge colors (Tailwind default palette covers purple + rose).
const TYPE_BADGE: Record<TransactionType, string> = {
  income:            "bg-success-soft text-success",
  expense:           "bg-danger-soft text-danger",
  shareholder_loan:  "bg-primary/10 text-navy",
  capital_injection: "bg-sky-100 text-sky-700",
  capital_expense:   "bg-warning-soft text-warning",
  loan_repayment:    "bg-purple-100 text-purple-700",
  interest_paid:     "bg-rose-100 text-rose-700",
};

export function TransactionsClient({ initialRows, shareholders: initialShareholders, outstandingMap, shareholderNames }: Props) {
  const { t } = useLang();
  const [rows, setRows] = useState<TransactionRow[]>(initialRows);
  const [shareholders, setShareholders] = useState<ShareholderRow[]>(initialShareholders);
  const [yearMonth, setYearMonth] = useState<string>(isoMonth());
  const [typeSet, setTypeSet] = useState<Set<TransactionType>>(new Set(TRANSACTION_TYPES));
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [prefill, setPrefill] = useState<TxPrefill | null>(null);
  const [prefillFile, setPrefillFile] = useState<File | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [scanning, setScanning] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const reuploadRef = useRef<HTMLInputElement>(null);
  const reuploadRowRef = useRef<TransactionRow | null>(null);

  // Re-fetch by month (type filter is applied in-memory below).
  useEffect(() => {
    const supabase = createClient();
    let q = supabase.from("transactions").select("*").order("date", { ascending: false });
    if (yearMonth) {
      const [y, m] = yearMonth.split("-").map(Number);
      const start = `${yearMonth}-01`;
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      q = q.gte("date", start).lt("date", next);
    }
    q.then(({ data, error }) => { if (!error && data) setRows(data as TransactionRow[]); });
  }, [yearMonth]);

  const visibleRows = useMemo(() => rows.filter((r) => typeSet.has(r.type)), [rows, typeSet]);

  // Deep-link from /capital "+ Add": /transactions?new=<type> opens the form
  // pre-set to that type. Read once on mount (client only).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("new");
    if (p && (TRANSACTION_TYPES as readonly string[]).includes(p)) {
      setEditing(null);
      setPrefill({ type: p as TransactionType });
      setModalOpen(true);
      // clean the URL so a refresh doesn't re-open
      window.history.replaceState({}, "", "/transactions");
    }
  }, []);

  function toggleType(ty: TransactionType) {
    setTypeSet((prev) => {
      const next = new Set(prev);
      if (next.has(ty)) next.delete(ty); else next.add(ty);
      // never allow empty → reset to all
      if (next.size === 0) return new Set(TRANSACTION_TYPES);
      return next;
    });
  }

  function openNew()  { setEditing(null); setPrefill(null); setPrefillFile(null); setModalOpen(true); }
  function openEdit(row: TransactionRow) { setEditing(row); setPrefill(null); setPrefillFile(null); setModalOpen(true); }

  function onSaved(saved: TransactionRow) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) { const c = [...prev]; c[idx] = saved; return c; }
      return [saved, ...prev];
    });
    setModalOpen(false);
  }

  function onDelete(row: TransactionRow) {
    const msg = row.receipt_url ? t.tx.confirmDeleteWithFile : t.tx.confirmDeleteTx;
    if (!confirm(msg)) return;
    startTransition(async () => {
      try {
        await deleteTransaction(row.id);
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      } catch (e) { alert(t.errors.deleteFailed + (e as Error).message); }
    });
  }

  function pickScanFile() { scanInputRef.current?.click(); }
  async function onScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
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
      setPrefillFile(f);            // keep the scanned image → upload to Drive on save
      setModalOpen(true);
    } catch (err) {
      alert(t.errors.scanFailed + (err as Error).message);
    } finally {
      setScanning(false);
    }
  }

  // 补传 — attach a receipt to an existing row that has no file yet.
  function pickReupload(row: TransactionRow) {
    reuploadRowRef.current = row;
    reuploadRef.current?.click();
  }
  async function onReuploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    const row = reuploadRowRef.current;
    reuploadRowRef.current = null;
    if (!f || !row) return;
    setUploadingId(row.id);
    try {
      const party = (row.shareholder_id && shareholderNames[row.shareholder_id]) || row.party || null;
      const res = await uploadReceiptToDrive({
        file: f,
        category: driveCategoryFor(row.type),
        linkedTable: "transactions",
        linkedId: row.id,
        dateIso: row.date,
        party,
        docType: row.type,
      });
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, receipt_url: res.webViewLink } : r)));
      } else {
        const k = res.kind;
        alert(k === "auth" ? t.tx.driveAuthErr : k === "quota" ? t.tx.driveQuotaErr : t.tx.driveUploadErr);
      }
    } catch (err) {
      alert(t.tx.driveUploadErr + " " + (err as Error).message);
    } finally {
      setUploadingId(null);
    }
  }

  function categoryLabel(r: TransactionRow): string {
    if (!r.category) return "—";
    if (r.type === "capital_expense" && (CAPITAL_CATEGORIES as readonly string[]).includes(r.category)) {
      return t.capitalCat[r.category as keyof typeof t.capitalCat];
    }
    return r.category;
  }
  function partyLabel(r: TransactionRow): string {
    if (r.shareholder_id && shareholderNames[r.shareholder_id]) return shareholderNames[r.shareholder_id];
    return r.party || "—";
  }
  const isInflow = (ty: TransactionType) => (INFLOW_TYPES as readonly string[]).includes(ty);
  const signFor  = (ty: TransactionType) => (isInflow(ty) ? "+" : "−");
  const colorFor = (ty: TransactionType) => (isInflow(ty) ? "text-success" : "text-danger");

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          {visibleRows.length} {visibleRows.length === 1 ? t.common.entry : t.common.entries}
        </div>
        <div className="flex items-center gap-2">
          <input ref={scanInputRef} type="file" accept="image/*" capture="environment" onChange={onScanFile} className="hidden" />
          <Button type="button" variant="outline" onClick={pickScanFile} disabled={scanning} className="border-gold text-navy hover:bg-gold/10">
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
        <div className="flex flex-wrap gap-3 items-center">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>{t.tx.filterMonth}</span>
            <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} className="border border-border rounded-md px-3 py-1.5 text-sm bg-background" />
          </label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setYearMonth("")} className="text-muted-foreground self-end">
            {t.tx.showOlder}
          </Button>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>{t.tx.filterTypeLabel}</span>
            <div className="flex flex-wrap gap-1">
              {TRANSACTION_TYPES.map((ty) => {
                const on = typeSet.has(ty);
                return (
                  <button key={ty} type="button" onClick={() => toggleType(ty)}
                    className={"px-2 py-1 rounded-md text-[11px] font-medium border transition-colors " +
                      (on ? TYPE_BADGE[ty] + " border-transparent" : "bg-card text-muted-foreground border-border")}>
                    {t.txType[ty]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* table */}
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium w-[110px]">{t.tx.date}</th>
              <th className="text-left px-4 py-3 font-medium w-[140px]">{t.tx.type}</th>
              <th className="text-left px-4 py-3 font-medium">{t.tx.category}</th>
              <th className="text-right px-4 py-3 font-medium w-[140px]">{t.tx.amount}</th>
              <th className="text-left px-4 py-3 font-medium">{t.tx.party} / {t.capital.shareholder}</th>
              <th className="text-left px-4 py-3 font-medium">{t.tx.note}</th>
              <th className="text-left px-4 py-3 font-medium w-[70px]">{t.tx.receipt}</th>
              <th className="w-[90px]"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-muted-foreground italic py-12">{t.common.empty}</td></tr>
            ) : visibleRows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="px-4 py-3">
                  <span className={"inline-block px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide " + TYPE_BADGE[r.type]}>
                    {t.txType[r.type]}
                  </span>
                </td>
                <td className="px-4 py-3">{categoryLabel(r)}</td>
                <td className={"px-4 py-3 text-right whitespace-nowrap font-semibold tabular-nums " + colorFor(r.type)}>
                  {signFor(r.type)} {fmtMoney(r.amount)}
                </td>
                <td className="px-4 py-3">{partyLabel(r)}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.note || "—"}</td>
                <td className="px-4 py-3">
                  {r.receipt_url ? (
                    <a href={r.receipt_url} target="_blank" rel="noreferrer" title={t.tx.openInDrive}
                      className="text-navy hover:text-gold underline">{t.actions.view}</a>
                  ) : uploadingId === r.id ? (
                    <span className="inline-flex items-center text-muted-foreground text-xs">
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />{t.tx.uploadingReceipt}
                    </span>
                  ) : (
                    <button type="button" onClick={() => pickReupload(r)} title={t.tx.uploadReceipt}
                      className="inline-flex items-center text-muted-foreground hover:text-navy text-xs">
                      <Upload className="w-3.5 h-3.5 mr-1" />{t.tx.uploadReceipt}
                    </button>
                  )}
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

      {/* hidden input for 补传 (supplemental receipt upload) */}
      <input ref={reuploadRef} type="file" accept="image/*,application/pdf" capture="environment" onChange={onReuploadFile} className="hidden" />

      <TransactionFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
        prefill={prefill}
        prefillFile={prefillFile}
        shareholders={shareholders}
        outstandingMap={outstandingMap}
        onShareholderAdded={(s) => setShareholders((prev) => [...prev, s])}
        onSaved={onSaved}
      />
    </div>
  );
}
