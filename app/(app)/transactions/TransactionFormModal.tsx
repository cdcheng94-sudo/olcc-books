"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, type TransactionType } from "@/lib/categories";
import { todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { TransactionRow } from "@/lib/types";
import { createTransaction, updateTransaction } from "./actions";
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
  prefill?: TxPrefill | null;     // pre-fill new entries (e.g. from OCR scan)
  onSaved: (row: TransactionRow) => void;
};

export function TransactionFormModal({ open, onOpenChange, editing, prefill, onSaved }: Props) {
  const { t } = useLang();
  const [date,     setDate]     = useState(todayIso());
  const [type,     setType]     = useState<TransactionType>("expense");
  const [category, setCategory] = useState<string>("Other Expense");
  const [amount,   setAmount]   = useState("");
  const [party,    setParty]    = useState("");
  const [note,     setNote]     = useState("");
  const [file,     setFile]     = useState<File | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string>("");
  const [confirmNoReceipt, setConfirmNoReceipt] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset form whenever the modal opens for a new entry or a different row
  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmNoReceipt(false);
    setFile(null);
    if (editing) {
      setDate(editing.date.substring(0, 10));
      setType(editing.type);
      setCategory(editing.category);
      setAmount(String(editing.amount));
      setParty(editing.party || "");
      setNote(editing.note || "");
      setExistingReceiptUrl(editing.receipt_url || "");
    } else {
      setDate(prefill?.date              ?? todayIso());
      setType(prefill?.type              ?? "expense");
      setCategory(prefill?.category      ?? "Other Expense");
      setAmount(prefill?.amount != null ? String(prefill.amount) : "");
      setParty(prefill?.party            ?? "");
      setNote(prefill?.note              ?? "");
      setExistingReceiptUrl("");
    }
  }, [open, editing, prefill]);

  // When type changes, snap to the first category of that type so we don't
  // end up with an income category on an expense entry.
  useEffect(() => {
    const allowed = type === "income" ? CATEGORIES.income : CATEGORIES.expense;
    if (!allowed.includes(category as never)) {
      setCategory(allowed[0]);
    }
  }, [type, category]);

  async function uploadReceiptIfAny(): Promise<string | undefined> {
    if (!file) return existingReceiptUrl || undefined;
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "bin";
    const today = new Date();
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const path = `${ym}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("receipts").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) throw new Error("Upload failed: " + upErr.message);
    const { data: pub } = supabase.storage.from("receipts").getPublicUrl(path);
    return pub.publicUrl;
  }

  function tryFinish() {
    // If no receipt + not yet confirmed, ask user to confirm
    if (!file && !existingReceiptUrl && !confirmNoReceipt) {
      setConfirmNoReceipt(true);
      return;
    }
    save();
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const receiptUrl = await uploadReceiptIfAny();
        const payload = {
          date,
          type,
          category,
          amount: Number(amount),
          party: party.trim() || undefined,
          note: note.trim() || undefined,
          receipt_url: receiptUrl,
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

  const categoryChoices = type === "income" ? CATEGORIES.income : CATEGORIES.expense;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t.tx.dialogEdit : t.tx.dialogNew}</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => { e.preventDefault(); tryFinish(); }}
            className="grid grid-cols-2 gap-3"
          >
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.tx.date}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.tx.type}</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="expense">{t.tx.expense}</option>
                <option value="income">{t.tx.income}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.tx.category}</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {categoryChoices.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.tx.amount} (MYR)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-xs">{t.tx.party}</Label>
              <Input value={party} onChange={(e) => setParty(e.target.value)} placeholder={t.tx.partyPlaceholder} />
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-xs">{t.tx.note}</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.tx.notePlaceholder} rows={2} />
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-xs">{t.tx.receipt}</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {existingReceiptUrl && !file && (
                <div className="text-xs text-muted-foreground mt-1">
                  {t.tx.currentReceipt}<a href={existingReceiptUrl} target="_blank" rel="noreferrer" className="text-navy underline">{t.tx.viewExisting}</a>
                  {t.tx.replaceHint}
                </div>
              )}
            </div>

            {error && <div className="col-span-2 text-sm text-destructive">{error}</div>}

            <DialogFooter className="col-span-2 mt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-light text-white">
                {isPending ? t.common.saving : t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* "No receipt" confirmation */}
      <Dialog open={confirmNoReceipt} onOpenChange={(o) => !o && setConfirmNoReceipt(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.tx.noReceiptTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t.tx.noReceiptDesc}
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmNoReceipt(false)}>
              {t.tx.goBackAttach}
            </Button>
            <Button type="button" onClick={() => { setConfirmNoReceipt(false); save(); }} className="bg-navy hover:bg-navy-light text-white">
              {t.tx.yesSaveWithout}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
