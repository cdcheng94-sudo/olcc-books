"use client";

import { useEffect, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES } from "@/lib/categories";
import { todayIso } from "@/lib/format";
import { FREQUENCIES, type Frequency } from "@/lib/recurring-utils";
import type { RecurringRow } from "@/lib/types";
import { createRecurring, updateRecurring } from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: RecurringRow | null;
  onSaved: (row: RecurringRow) => void;
};

export function RecurringFormModal({ open, onOpenChange, editing, onSaved }: Props) {
  const [name, setName]           = useState("");
  const [payee, setPayee]         = useState("");
  const [amount, setAmount]       = useState("");
  const [category, setCategory]   = useState("Other Expense");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [nextDue, setNextDue]     = useState(todayIso());
  const [remindDays, setRemindDays] = useState("7");
  const [status, setStatus]       = useState<"active" | "paused">("active");
  const [error, setError]         = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setName(editing.name);
      setPayee(editing.payee || "");
      setAmount(String(editing.amount));
      setCategory(editing.category);
      setFrequency(editing.frequency);
      setNextDue(editing.next_due_date.substring(0, 10));
      setRemindDays(String(editing.remind_days_before));
      setStatus(editing.status);
    } else {
      setName(""); setPayee(""); setAmount(""); setCategory("Other Expense");
      setFrequency("monthly"); setNextDue(todayIso()); setRemindDays("7"); setStatus("active");
    }
  }, [open, editing]);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          name, payee: payee || undefined, amount: Number(amount),
          category, frequency, next_due_date: nextDue,
          remind_days_before: Number(remindDays), status,
        };
        const saved = editing ? await updateRecurring(editing.id, payload) : await createRecurring(payload);
        onSaved(saved as RecurringRow);
      } catch (e) { setError((e as Error).message); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit recurring" : "New recurring payment"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Annual Accountant Fee" required />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-xs">Payee (who you pay)</Label>
            <Input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Amount (MYR)</Label>
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Category</Label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              {CATEGORIES.expense.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Frequency</Label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="h-9 rounded-md border border-input bg-background px-3 text-sm capitalize">
              {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Next due date</Label>
            <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Remind days before</Label>
            <Input type="number" min="0" max="365" value={remindDays} onChange={(e) => setRemindDays(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Status</Label>
            <select value={status} onChange={(e) => setStatus(e.target.value as "active" | "paused")} className="h-9 rounded-md border border-input bg-background px-3 text-sm capitalize">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
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
