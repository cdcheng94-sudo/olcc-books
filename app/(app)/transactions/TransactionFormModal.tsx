"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORIES, CAPITAL_CATEGORIES, TRANSACTION_TYPES,
  type TransactionType,
} from "@/lib/categories";
import { todayIso, fmtMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { TransactionRow, ShareholderRow } from "@/lib/types";
import { createTransaction, updateTransaction } from "./actions";
import { createShareholder } from "../shareholders/actions";
import { useLang } from "@/components/LangProvider";

export type TxPrefill = {
  date?:     string;
  type?:     TransactionType;
  category?: string;
  amount?:   number;
  party?:    string;
  note?:     string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: TransactionRow | null;
  prefill?: TxPrefill | null;
  shareholders: ShareholderRow[];
  outstandingMap: Record<string, number>;     // shareholder_id → outstanding
  onShareholderAdded: (s: ShareholderRow) => void;
  onSaved: (row: TransactionRow) => void;
};

const NEEDS_SHAREHOLDER: TransactionType[] = ["shareholder_loan", "capital_injection", "loan_repayment", "interest_paid"];
const NEEDS_RECEIPT:     TransactionType[] = ["income", "expense", "shareholder_loan", "capital_injection", "capital_expense", "loan_repayment"];

export function TransactionFormModal({
  open, onOpenChange, editing, prefill, shareholders, outstandingMap, onShareholderAdded, onSaved,
}: Props) {
  const { t } = useLang();
  const [date,     setDate]     = useState(todayIso());
  const [type,     setType]     = useState<TransactionType>("income");
  const [category, setCategory] = useState<string>("Sales Income");
  const [amount,   setAmount]   = useState("");
  const [party,    setParty]    = useState("");
  const [note,     setNote]     = useState("");
  const [shareholderId, setShareholderId] = useState("");
  const [interestRate, setInterestRate]   = useState("0");
  const [file,     setFile]     = useState<File | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string>("");
  const [confirmNoReceipt, setConfirmNoReceipt] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // inline "+ new shareholder"
  const [addingSh, setAddingSh] = useState(false);
  const [newShName, setNewShName] = useState("");
  const [shPending, startShTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmNoReceipt(false);
    setFile(null);
    setAddingSh(false);
    setNewShName("");
    if (editing) {
      setDate(editing.date.substring(0, 10));
      setType(editing.type);
      setCategory(editing.category ?? "");
      setAmount(String(editing.amount));
      setParty(editing.party || "");
      setNote(editing.note || "");
      setShareholderId(editing.shareholder_id || "");
      setInterestRate(String(editing.interest_rate ?? 0));
      setExistingReceiptUrl(editing.receipt_url || "");
    } else {
      const initType = prefill?.type ?? "income";
      setType(initType);
      setDate(prefill?.date ?? todayIso());
      setCategory(prefill?.category ?? defaultCategoryFor(initType));
      setAmount(prefill?.amount != null ? String(prefill.amount) : "");
      setParty(prefill?.party ?? "");
      setNote(prefill?.note ?? "");
      setShareholderId("");
      setInterestRate("0");
      setExistingReceiptUrl("");
    }
  }, [open, editing, prefill]);

  // Snap category to a valid value for the current type.
  useEffect(() => {
    if (type === "income" && !CATEGORIES.income.includes(category as never)) setCategory(CATEGORIES.income[0]);
    else if (type === "expense" && !CATEGORIES.expense.includes(category as never)) setCategory(CATEGORIES.expense[0]);
    else if (type === "capital_expense" && !CAPITAL_CATEGORIES.includes(category as never)) setCategory(CAPITAL_CATEGORIES[0]);
  }, [type, category]);

  async function uploadReceiptIfAny(): Promise<string | undefined> {
    if (!file) return existingReceiptUrl || undefined;
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "bin";
    const today = new Date();
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const path = `${ym}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("receipts").upload(path, file, { cacheControl: "3600", upsert: false });
    if (upErr) throw new Error("Upload failed: " + upErr.message);
    const { data: pub } = supabase.storage.from("receipts").getPublicUrl(path);
    return pub.publicUrl;
  }

  function addShareholder() {
    if (!newShName.trim()) return;
    startShTransition(async () => {
      try {
        const sh = await createShareholder(newShName);
        onShareholderAdded(sh);
        setShareholderId(sh.id);
        setAddingSh(false);
        setNewShName("");
      } catch (e) { setError((e as Error).message); }
    });
  }

  function tryFinish() {
    // No-receipt confirm only for plain operating income/expense.
    const operating = type === "income" || type === "expense";
    if (operating && !file && !existingReceiptUrl && !confirmNoReceipt) {
      setConfirmNoReceipt(true);
      return;
    }
    save();
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const receiptUrl = NEEDS_RECEIPT.includes(type) ? await uploadReceiptIfAny() : undefined;
        const payload = {
          date,
          type,
          category: (type === "income" || type === "expense" || type === "capital_expense") ? category : undefined,
          amount: Number(amount),
          party: (type === "income" || type === "expense" || type === "capital_expense") ? (party.trim() || undefined) : undefined,
          note: note.trim() || undefined,
          receipt_url: receiptUrl,
          shareholder_id: NEEDS_SHAREHOLDER.includes(type) ? (shareholderId || undefined) : undefined,
          interest_rate: type === "shareholder_loan" ? Number(interestRate) : undefined,
        };
        const saved = editing
          ? await updateTransaction(editing.id, payload)
          : await createTransaction(payload);
        onSaved(saved as TransactionRow);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const showCategory   = type === "income" || type === "expense" || type === "capital_expense";
  const showParty      = type === "income" || type === "expense" || type === "capital_expense";
  const showShareholder= NEEDS_SHAREHOLDER.includes(type);
  const showInterestRate = type === "shareholder_loan";
  const showReceipt    = NEEDS_RECEIPT.includes(type);
  const noteLabel      = type === "interest_paid" ? t.capital.periodNote : t.tx.note;
  const notePlaceholder= type === "interest_paid" ? t.capital.periodPlaceholder : t.tx.notePlaceholder;

  const categoryChoices: { value: string; label: string }[] =
    type === "income"          ? CATEGORIES.income.map((c) => ({ value: c, label: c })) :
    type === "expense"         ? CATEGORIES.expense.map((c) => ({ value: c, label: c })) :
    type === "capital_expense" ? CAPITAL_CATEGORIES.map((c) => ({ value: c, label: t.capitalCat[c] })) :
    [];

  const outstanding = shareholderId ? (outstandingMap[shareholderId] ?? 0) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t.tx.dialogEdit : t.tx.dialogNew}</DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); tryFinish(); }} className="grid grid-cols-2 gap-3">
            {/* Type — full width with help line */}
            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-xs">{t.tx.type}</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {TRANSACTION_TYPES.map((ty, i) => (
                  <option key={ty} value={ty}>
                    {i === 2 ? "──────────  " : ""}{t.txType[ty]}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-muted-foreground italic">{t.txTypeHelp[type]}</div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.tx.date}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.tx.amount} (MYR)</Label>
              <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>

            {showCategory && (
              <div className="flex flex-col gap-1 col-span-2">
                <Label className="text-xs">{t.tx.category}</Label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {categoryChoices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            )}

            {showShareholder && (
              <div className="flex flex-col gap-1 col-span-2">
                <Label className="text-xs">{t.capital.shareholder} *</Label>
                {!addingSh ? (
                  <div className="flex gap-2">
                    <select value={shareholderId} onChange={(e) => setShareholderId(e.target.value)} required className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="" disabled>— {t.capital.shareholder} —</option>
                      {shareholders.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <Button type="button" variant="outline" onClick={() => setAddingSh(true)} className="border-gold text-navy hover:bg-gold/10 whitespace-nowrap">
                      <Plus className="w-3.5 h-3.5 mr-1" />{t.capital.newShareholder}
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input value={newShName} onChange={(e) => setNewShName(e.target.value)} placeholder={t.capital.newShareholderName} className="flex-1" autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addShareholder(); } }} />
                    <Button type="button" onClick={addShareholder} disabled={shPending} className="bg-navy hover:bg-navy-light text-white">{t.common.add}</Button>
                    <Button type="button" variant="ghost" onClick={() => { setAddingSh(false); setNewShName(""); }}>{t.common.cancel}</Button>
                  </div>
                )}
                {/* outstanding hint for repayment */}
                {type === "loan_repayment" && shareholderId && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {t.capital.currentOutstanding}: <span className="font-semibold tabular-nums text-navy">{fmtMoney(outstanding ?? 0)}</span>
                  </div>
                )}
              </div>
            )}

            {showInterestRate && (
              <div className="flex flex-col gap-1 col-span-2">
                <Label className="text-xs">{t.capital.interestRate}</Label>
                <Input type="number" step="0.01" min="0" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
              </div>
            )}

            {showParty && (
              <div className="flex flex-col gap-1 col-span-2">
                <Label className="text-xs">{t.tx.party}</Label>
                <Input value={party} onChange={(e) => setParty(e.target.value)} placeholder={t.tx.partyPlaceholder} />
              </div>
            )}

            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-xs">{noteLabel}</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={notePlaceholder} rows={2} />
            </div>

            {showReceipt && (
              <div className="flex flex-col gap-1 col-span-2">
                <Label className="text-xs">{t.tx.receipt}</Label>
                <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                {existingReceiptUrl && !file && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {t.tx.currentReceipt}<a href={existingReceiptUrl} target="_blank" rel="noreferrer" className="text-navy underline">{t.tx.viewExisting}</a>{t.tx.replaceHint}
                  </div>
                )}
              </div>
            )}

            {error && <div className="col-span-2 text-sm text-destructive">{error}</div>}

            <DialogFooter className="col-span-2 mt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>{t.common.cancel}</Button>
              <Button type="submit" disabled={isPending || addingSh} className="bg-navy hover:bg-navy-light text-white">
                {isPending ? t.common.saving : t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* "No receipt" confirmation (income/expense only) */}
      <Dialog open={confirmNoReceipt} onOpenChange={(o) => !o && setConfirmNoReceipt(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.tx.noReceiptTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t.tx.noReceiptDesc}</p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmNoReceipt(false)}>{t.tx.goBackAttach}</Button>
            <Button type="button" onClick={() => { setConfirmNoReceipt(false); save(); }} className="bg-navy hover:bg-navy-light text-white">{t.tx.yesSaveWithout}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function defaultCategoryFor(type: TransactionType): string {
  if (type === "income")          return CATEGORIES.income[0];
  if (type === "expense")         return CATEGORIES.expense[0];
  if (type === "capital_expense") return CAPITAL_CATEGORIES[0];
  return "";
}
