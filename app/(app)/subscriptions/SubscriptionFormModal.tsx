"use client";

import { useEffect, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/components/LangProvider";
import { todayIso } from "@/lib/format";
import { FREQUENCIES, type Frequency } from "@/lib/recurring-utils";
import type { SubscriptionRow } from "@/lib/types";
import { createSubscription, updateSubscription } from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SubscriptionRow | null;
  onSaved: (row: SubscriptionRow) => void;
};

export function SubscriptionFormModal({ open, onOpenChange, editing, onSaved }: Props) {
  const { t } = useLang();
  const [customerName, setCustomerName]   = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceDesc, setServiceDesc]     = useState("");
  const [amount, setAmount]               = useState("");
  const [frequency, setFrequency]         = useState<Frequency>("monthly");
  const [nextCharge, setNextCharge]       = useState(todayIso());
  const [remindDays, setRemindDays]       = useState("7");
  const [status, setStatus]               = useState<"active" | "paused">("active");
  const [error, setError]                 = useState<string | null>(null);
  const [isPending, startTransition]      = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setCustomerName(editing.customer_name);
      setCustomerEmail(editing.customer_email || "");
      setCustomerPhone(editing.customer_phone || "");
      setServiceDesc(editing.service_desc);
      setAmount(String(editing.amount));
      setFrequency(editing.frequency);
      setNextCharge(editing.next_charge_date.substring(0, 10));
      setRemindDays(String(editing.remind_days_before));
      setStatus(editing.status);
    } else {
      setCustomerName(""); setCustomerEmail(""); setCustomerPhone(""); setServiceDesc("");
      setAmount(""); setFrequency("monthly"); setNextCharge(todayIso());
      setRemindDays("7"); setStatus("active");
    }
  }, [open, editing]);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          customer_name: customerName,
          customer_email: customerEmail || undefined,
          customer_phone: customerPhone || undefined,
          service_desc: serviceDesc,
          amount: Number(amount),
          frequency,
          next_charge_date: nextCharge,
          remind_days_before: Number(remindDays),
          status,
        };
        const saved = editing ? await updateSubscription(editing.id, payload) : await createSubscription(payload);
        onSaved(saved as SubscriptionRow);
      } catch (e) { setError((e as Error).message); }
    });
  }

  const freqLabel: Record<Frequency, string> = {
    monthly:   t.common.monthly,
    quarterly: t.common.quarterly,
    yearly:    t.common.yearly,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t.subscriptions.dialogEdit : t.subscriptions.dialogNew}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-xs">{t.subscriptions.formCustomerName}</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t.subscriptions.formCustomerEmail}</Label>
            <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t.subscriptions.formCustomerPhone}</Label>
            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder={t.subscriptions.formPhonePlaceholder} />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-xs">{t.subscriptions.formServiceDesc}</Label>
            <Input value={serviceDesc} onChange={(e) => setServiceDesc(e.target.value)} placeholder={t.subscriptions.formServicePlaceholder} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t.subscriptions.formAmount}</Label>
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t.subscriptions.formFrequency}</Label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              {FREQUENCIES.map((f) => <option key={f} value={f}>{freqLabel[f]}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t.subscriptions.formNextCharge}</Label>
            <Input type="date" value={nextCharge} onChange={(e) => setNextCharge(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t.subscriptions.formRemindDays}</Label>
            <Input type="number" min="0" max="365" value={remindDays} onChange={(e) => setRemindDays(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-xs">{t.subscriptions.formStatus}</Label>
            <select value={status} onChange={(e) => setStatus(e.target.value as "active" | "paused")} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="active">{t.status.active}</option>
              <option value="paused">{t.status.paused}</option>
            </select>
          </div>
          {error && <div className="col-span-2 text-sm text-destructive">{error}</div>}
          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>{t.common.cancel}</Button>
            <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-light text-white">
              {isPending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
