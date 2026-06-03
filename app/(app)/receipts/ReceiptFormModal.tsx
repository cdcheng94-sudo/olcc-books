"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/components/LangProvider";
import { fmtMoney, todayIso } from "@/lib/format";
import { PAYMENT_METHODS, CATEGORIES } from "@/lib/categories";
import type { LineItem, ReceiptRow } from "@/lib/types";
import { createReceipt } from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (row: ReceiptRow) => void;
};

type DraftItem = { desc: string; qty: string; unit_price: string };
function newItem(): DraftItem { return { desc: "", qty: "1", unit_price: "" }; }

export function ReceiptFormModal({ open, onOpenChange, onSaved }: Props) {
  const { t } = useLang();
  const [date,            setDate]            = useState(todayIso());
  const [customerName,    setCustomerName]    = useState("");
  const [customerEmail,   setCustomerEmail]   = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [items,           setItems]           = useState<DraftItem[]>([newItem()]);
  const [discount,        setDiscount]        = useState("0");
  const [tax,             setTax]             = useState("0");
  const [paymentMethod,   setPaymentMethod]   = useState<string>("Bank Transfer");
  const [category,        setCategory]        = useState<string>("Service Income");
  const [error,           setError]           = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDate(todayIso());
    setCustomerName(""); setCustomerEmail(""); setCustomerAddress("");
    setItems([newItem()]); setDiscount("0"); setTax("0");
    setPaymentMethod("Bank Transfer"); setCategory("Service Income");
  }, [open]);

  function updateItem(i: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function addItem()             { setItems((prev) => [...prev, newItem()]); }
  function removeItem(i: number) { setItems((prev) => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)); }

  const computedItems: LineItem[] = items.map((it) => {
    const qty  = Number(it.qty)        || 0;
    const unit = Number(it.unit_price) || 0;
    return { desc: it.desc, qty, unit_price: unit, amount: +(qty * unit).toFixed(2) };
  });
  const subtotal    = computedItems.reduce((s, it) => s + it.amount, 0);
  const discountPct = Math.min(100, Math.max(0, Number(discount) || 0));
  const discountAmt = subtotal * (discountPct / 100);
  const taxNum      = Number(tax) || 0;
  const total       = subtotal - discountAmt + taxNum;

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const saved = await createReceipt({
          date,
          customer_name:    customerName,
          customer_email:   customerEmail   || undefined,
          customer_address: customerAddress || undefined,
          items:            computedItems,
          discount_percent: discountPct,
          tax:              taxNum,
          payment_method:   paymentMethod,
          category_for_income: category,
        });
        onSaved(saved as ReceiptRow);
      } catch (e) { setError((e as Error).message); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.receipt.dialogNew}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-xs">{t.receipt.formCustomerName}</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.receipt.formCustomerEmail}</Label>
              <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.receipt.formCustomerAddr}</Label>
              <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.receipt.formDate}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.receipt.formPaymentMethod}</Label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-xs">{t.receipt.formIncomeCategory}</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                {CATEGORIES.income.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1.5 inline-block">{t.receipt.formLineItems}</Label>
            <div className="border border-border rounded-md overflow-hidden">
              <div className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground grid grid-cols-[1fr_60px_100px_100px_28px] gap-2 px-3 py-2 font-medium">
                <div>{t.receipt.formDescription}</div>
                <div className="text-right">{t.receipt.formQty}</div>
                <div className="text-right">{t.receipt.formUnitPrice}</div>
                <div className="text-right">{t.receipt.formAmount}</div>
                <div></div>
              </div>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_60px_100px_100px_28px] gap-2 px-3 py-1.5 border-t border-border items-center">
                  <Input value={it.desc} onChange={(e) => updateItem(i, { desc: e.target.value })} placeholder={t.receipt.formItemPlaceholder} className="h-8 text-sm" required />
                  <Input type="number" step="1" min="0" value={it.qty} onChange={(e) => updateItem(i, { qty: e.target.value })} className="h-8 text-sm text-right tabular-nums" required />
                  <Input type="number" step="0.01" min="0" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: e.target.value })} className="h-8 text-sm text-right tabular-nums" required />
                  <div className="text-sm text-right tabular-nums font-medium">{fmtMoney(computedItems[i].amount)}</div>
                  <button type="button" onClick={() => removeItem(i)} className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30" disabled={items.length === 1} title={t.actions.removeLine}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addItem} className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:bg-muted/40 hover:text-navy border-t border-border">
                <Plus className="w-3.5 h-3.5" />
                {t.receipt.formAddLine}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t.receipt.formDiscount}</Label>
                <Input type="number" step="0.5" min="0" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t.receipt.formTax}</Label>
                <Input type="number" step="0.01" min="0" value={tax} onChange={(e) => setTax(e.target.value)} />
              </div>
            </div>
            <div className="bg-muted/30 rounded-md p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t.receipt.formSubtotal}</span><span className="tabular-nums">{fmtMoney(subtotal)}</span></div>
              {discountPct > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t.receipt.formDiscountLine.replace("{pct}", String(discountPct))}</span><span className="tabular-nums text-destructive">−{fmtMoney(discountAmt)}</span></div>}
              {taxNum > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t.receipt.formTaxLabel}</span><span className="tabular-nums">{fmtMoney(taxNum)}</span></div>}
              <div className="flex justify-between border-t border-border mt-2 pt-2 font-bold"><span>{t.receipt.formReceived}</span><span className="tabular-nums text-success">{fmtMoney(total)}</span></div>
            </div>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <DialogFooter className="mt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>{t.common.cancel}</Button>
            <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-light text-white">
              {isPending ? t.common.saving : t.receipt.btnCreate}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
