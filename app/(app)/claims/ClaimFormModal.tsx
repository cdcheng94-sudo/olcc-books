"use client";

import { useEffect, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayIso } from "@/lib/format";
import { CLAIM_CATEGORIES } from "@/lib/categories";
import type { ClaimRow } from "@/lib/types";
import { createClaim, updateClaim } from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ClaimRow | null;
  onSaved: (row: ClaimRow) => void;
};

export function ClaimFormModal({ open, onOpenChange, editing, onSaved }: Props) {
  const [date,       setDate]       = useState(todayIso());
  const [claimant,   setClaimant]   = useState("");
  const [itemDesc,   setItemDesc]   = useState("");
  const [amount,     setAmount]     = useState("");
  const [category,   setCategory]   = useState<string>(CLAIM_CATEGORIES[0]);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [note,       setNote]       = useState("");
  const [error,      setError]      = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setDate(editing.date);
      setClaimant(editing.claimant);
      setItemDesc(editing.item_desc);
      setAmount(String(editing.amount));
      setCategory(editing.category);
      setReceiptUrl(editing.receipt_url || "");
      setNote(editing.note || "");
    } else {
      setDate(todayIso());
      setClaimant(""); setItemDesc(""); setAmount("");
      setCategory(CLAIM_CATEGORIES[0]); setReceiptUrl(""); setNote("");
    }
  }, [open, editing]);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          date,
          claimant,
          item_desc:   itemDesc,
          amount:      Number(amount),
          category,
          receipt_url: receiptUrl || undefined,
          note:        note || undefined,
        };
        const saved = editing
          ? await updateClaim(editing.id, payload)
          : await createClaim(payload);
        onSaved(saved as ClaimRow);
      } catch (e) { setError((e as Error).message); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit claim" : "New claim"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Category</Label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              {CLAIM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-xs">Claimant</Label>
            <Input value={claimant} onChange={(e) => setClaimant(e.target.value)} placeholder="Staff name" required />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-xs">Item / what was spent on</Label>
            <Input value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} placeholder="e.g. Grab to site visit" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Amount (MYR)</Label>
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Receipt link (optional)</Label>
            <Input value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} placeholder="https://drive.google.com/..." />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-xs">Note (optional)</Label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
          {error && <div className="col-span-2 text-sm text-destructive">{error}</div>}
          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-light text-white">
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
