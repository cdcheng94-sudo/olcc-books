"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtMoney, todayIso } from "@/lib/format";
import type { InvoiceRow, LineItem } from "@/lib/types";
import { createInvoice, updateInvoice } from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: InvoiceRow | null;
  onSaved: (row: InvoiceRow) => void;
};

type DraftItem = { desc: string; qty: string; unit_price: string };

function newItem(): DraftItem { return { desc: "", qty: "1", unit_price: "" }; }

function plusDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function InvoiceFormModal({ open, onOpenChange, editing, onSaved }: Props) {
  const [date,            setDate]            = useState(todayIso());
  const [dueDate,         setDueDate]         = useState(plusDays(todayIso(), 30));
  const [customerName,    setCustomerName]    = useState("");
  const [customerEmail,   setCustomerEmail]   = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [siteAddress,     setSiteAddress]     = useState("");
  const [items,           setItems]           = useState<DraftItem[]>([newItem()]);
  const [tax,             setTax]             = useState("0");
  const [note,            setNote]            = useState("");
  const [error,           setError]           = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setDate(editing.date);
      setDueDate(editing.due_date);
      setCustomerName(editing.customer_name);
      setCustomerEmail(editing.customer_email || "");
      setCustomerAddress(editing.customer_address || "");
      setSiteAddress(editing.site_address || "");
      setItems(editing.items.length > 0
        ? editing.items.map((it) => ({ desc: it.desc, qty: String(it.qty), unit_price: String(it.unit_price) }))
        : [newItem()]);
      setTax(String(editing.tax));
      setNote(editing.note || "");
    } else {
      setDate(todayIso());
      setDueDate(plusDays(todayIso(), 30));
      setCustomerName(""); setCustomerEmail(""); setCustomerAddress(""); setSiteAddress("");
      setItems([newItem()]); setTax("0"); setNote("");
    }
  }, [open, editing]);

  function updateItem(i: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function addItem()     { setItems((prev) => [...prev, newItem()]); }
  function removeItem(i: number) { setItems((prev) => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)); }

  const computedItems: LineItem[] = items.map((it) => {
    const qty   = Number(it.qty)        || 0;
    const unit  = Number(it.unit_price) || 0;
    const amt   = +(qty * unit).toFixed(2);
    return { desc: it.desc, qty, unit_price: unit, amount: amt };
  });
  const subtotal = computedItems.reduce((sum, it) => sum + it.amount, 0);
  const taxNum   = Number(tax) || 0;
  const total    = subtotal + taxNum;

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          date, due_date: dueDate,
          customer_name: customerName,
          customer_email:   customerEmail   || undefined,
          customer_address: customerAddress || undefined,
          site_address:     siteAddress     || undefined,
          items: computedItems,
          tax: taxNum,
          note: note || undefined,
        };
        const saved = editing
          ? await updateInvoice(editing.id, payload)
          : await createInvoice(payload);
        onSaved(saved as InvoiceRow);
      } catch (e) { setError((e as Error).message); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${editing.invoice_number}` : "New invoice"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-4">
          {/* Customer + dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-xs">Customer name</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Customer email</Label>
              <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="needed to send via email" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Customer address (optional)</Label>
              <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-xs">Site / project address (optional)</Label>
              <Input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Invoice date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>
          </div>

          {/* Line items */}
          <div>
            <Label className="text-xs mb-1.5 inline-block">Line items</Label>
            <div className="border border-border rounded-md overflow-hidden">
              <div className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground grid grid-cols-[1fr_60px_100px_100px_28px] gap-2 px-3 py-2 font-medium">
                <div>Description</div>
                <div className="text-right">Qty</div>
                <div className="text-right">Unit Price</div>
                <div className="text-right">Amount</div>
                <div></div>
              </div>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_60px_100px_100px_28px] gap-2 px-3 py-1.5 border-t border-border items-center">
                  <Input value={it.desc} onChange={(e) => updateItem(i, { desc: e.target.value })} placeholder="Service or item" className="h-8 text-sm" required />
                  <Input type="number" step="1" min="0" value={it.qty} onChange={(e) => updateItem(i, { qty: e.target.value })} className="h-8 text-sm text-right tabular-nums" required />
                  <Input type="number" step="0.01" min="0" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: e.target.value })} className="h-8 text-sm text-right tabular-nums" required />
                  <div className="text-sm text-right tabular-nums font-medium">{fmtMoney(computedItems[i].amount)}</div>
                  <button type="button" onClick={() => removeItem(i)} className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30" disabled={items.length === 1} title="Remove line">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addItem} className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:bg-muted/40 hover:text-navy border-t border-border">
                <Plus className="w-3.5 h-3.5" />
                Add line
              </button>
            </div>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Tax / SST (amount)</Label>
              <Input type="number" step="0.01" min="0" value={tax} onChange={(e) => setTax(e.target.value)} />
            </div>
            <div className="bg-muted/30 rounded-md p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{fmtMoney(subtotal)}</span></div>
              {taxNum > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular-nums">{fmtMoney(taxNum)}</span></div>}
              <div className="flex justify-between border-t border-border mt-2 pt-2 font-bold"><span>Total</span><span className="tabular-nums text-navy">{fmtMoney(total)}</span></div>
            </div>
          </div>

          {/* Note */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Note (shown on PDF, optional)</Label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <DialogFooter className="mt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-light text-white">
              {isPending ? "Saving…" : editing ? "Save" : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
