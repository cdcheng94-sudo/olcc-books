"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, GraduationCap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtMoney, todayIso } from "@/lib/format";
import { EDUFLOW_PLAN_LIST, EDUFLOW_PLANS, type EduFlowPlanKey } from "@/lib/eduflow-plans";
import { onboardEduFlowCustomer } from "./actions";

/**
 * Single-form onboarding flow for an EduFlow customer:
 *   pick plan → enter customer info → submit → invoice + subscription
 *   created in one shot, then redirected to /invoices for review.
 */

export function EduFlowClient() {
  const router = useRouter();
  const [planKey, setPlanKey] = useState<EduFlowPlanKey>("professional");
  const [customerName,    setCustomerName]    = useState("");
  const [customerEmail,   setCustomerEmail]   = useState("");
  const [customerPhone,   setCustomerPhone]   = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [startDate,       setStartDate]       = useState(todayIso());
  const [monthlyOverride, setMonthlyOverride] = useState("");
  const [setupOverride,   setSetupOverride]   = useState("");
  const [firstFree,       setFirstFree]       = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const plan = EDUFLOW_PLANS[planKey];
  // Effective values (override beats default)
  const monthlyEff = useMemo(() => Number(monthlyOverride || plan.monthly), [monthlyOverride, plan.monthly]);
  const setupEff   = useMemo(() => Number(setupOverride   || plan.setup),   [setupOverride,   plan.setup]);
  const firstFreeEff = firstFree ?? plan.firstMonthFree;
  const firstInvoiceTotal = setupEff + (firstFreeEff ? 0 : monthlyEff);

  function pickPlan(k: EduFlowPlanKey) {
    setPlanKey(k);
    // Reset overrides + firstFree to plan defaults when switching
    setMonthlyOverride("");
    setSetupOverride("");
    setFirstFree(null);
  }

  function submit() {
    setError(null);
    if (!customerName.trim()) { setError("Customer name required."); return; }
    startTransition(async () => {
      try {
        await onboardEduFlowCustomer({
          customer_name:    customerName.trim(),
          customer_email:   customerEmail.trim()   || undefined,
          customer_phone:   customerPhone.trim()   || undefined,
          customer_address: customerAddress.trim() || undefined,
          plan:             planKey,
          start_date:       startDate,
          monthly_override: monthlyOverride ? Number(monthlyOverride) : undefined,
          setup_override:   setupOverride   ? Number(setupOverride)   : undefined,
          first_month_free: firstFreeEff,
        });
        alert(
          `✓ Onboarded ${customerName}\n\n` +
          `• New invoice created for ${fmtMoney(firstInvoiceTotal)}\n` +
          `• Monthly subscription tracking ${fmtMoney(monthlyEff)} starts next month\n\n` +
          `Opening Invoices so you can email it to the customer.`,
        );
        router.push("/invoices");
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <GraduationCap size={20} className="text-gold" />
          New EduFlow Customer
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          One form. Creates the setup invoice and the monthly subscription in one click.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">
        {EDUFLOW_PLAN_LIST.map((p) => {
          const selected = p.key === planKey;
          const isPro    = p.key === "professional";
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => pickPlan(p.key)}
              className={
                "text-left rounded-xl transition-all p-5 relative " +
                (selected
                  ? "border-2 border-gold bg-gold/[0.08] shadow-lg ring-4 ring-gold/25"
                  : "border-2 border-border bg-card hover:border-gold/60 hover:shadow-sm")
              }
            >
              {/* gold top strip on selected card (rounded to match card corners) */}
              {selected && <div className="absolute top-0 left-0 right-0 h-1.5 bg-gold rounded-t-[0.4rem]" />}
              {isPro && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-primary-deep text-[10px] font-bold tracking-wider px-3 py-0.5 rounded-full uppercase">
                  Most popular
                </span>
              )}
              <div className="flex items-center gap-1.5 mb-1">
                <div className="text-base font-bold text-navy">{p.label}</div>
                {selected && (
                  <span className="ml-auto bg-gold text-primary-deep rounded-full w-5 h-5 flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mb-3 min-h-[28px]">{p.audience}</div>
              <div className="text-2xl font-bold text-navy">{fmtMoney(p.monthly)}<span className="text-xs text-muted-foreground font-normal"> / mo</span></div>
              <div className="text-xs text-muted-foreground mb-3">Setup {fmtMoney(p.setup)} {p.enterpriseEditable ? <span className="italic">(starts at)</span> : null}</div>
              {p.firstMonthFree && (
                <div className="inline-block bg-success-soft text-success text-[10px] font-bold px-2 py-0.5 rounded-full mb-3">
                  FIRST MONTH FREE
                </div>
              )}
              <ul className="text-xs text-muted-foreground flex flex-col gap-1 mt-2">
                {p.features.slice(0, 4).map((f, i) => (
                  <li key={i} className="flex gap-1.5">
                    <Check size={12} className="text-success mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Sparkles size={16} className="text-gold" />
            Customer details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="flex flex-col gap-1 md:col-span-2">
              <Label className="text-xs">Customer name *</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required placeholder="Tuition centre / school name" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="needed to email invoice + receipts" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Phone (intl)</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="60123456789 (for WhatsApp reminders)" />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <Label className="text-xs">Address (optional)</Label>
              <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none pb-1">
                <input
                  type="checkbox"
                  checked={firstFreeEff}
                  onChange={(e) => setFirstFree(e.target.checked)}
                  className="w-4 h-4 accent-navy"
                />
                <span>First month free</span>
                <span className="text-[10px] text-muted-foreground">
                  {plan.firstMonthFree ? "(default for " + plan.label + ")" : ""}
                </span>
              </label>
            </div>

            {/* Override fields (always editable, but only highlighted for Enterprise) */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs">
                Monthly amount <span className="text-muted-foreground">(override, optional)</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={monthlyOverride}
                onChange={(e) => setMonthlyOverride(e.target.value)}
                placeholder={`Default: ${plan.monthly}`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">
                Setup fee <span className="text-muted-foreground">(override, optional)</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={setupOverride}
                onChange={(e) => setSetupOverride(e.target.value)}
                placeholder={`Default: ${plan.setup}`}
              />
            </div>

            {/* Summary */}
            <div className="md:col-span-2 bg-muted/30 rounded-md p-4 text-sm">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold mb-2">First invoice will include</div>
              <div className="flex justify-between text-xs">
                <span>EduFlow {plan.label} — Setup fee</span>
                <span className="tabular-nums">{fmtMoney(setupEff)}</span>
              </div>
              {!firstFreeEff && (
                <div className="flex justify-between text-xs">
                  <span>EduFlow {plan.label} — First month</span>
                  <span className="tabular-nums">{fmtMoney(monthlyEff)}</span>
                </div>
              )}
              {firstFreeEff && (
                <div className="flex justify-between text-xs text-success">
                  <span>EduFlow {plan.label} — First month</span>
                  <span className="font-bold">FREE</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border mt-2 pt-2 text-sm font-bold">
                <span>Invoice total</span>
                <span className="tabular-nums text-navy">{fmtMoney(firstInvoiceTotal)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">
                Plus a monthly subscription of <span className="font-bold text-navy">{fmtMoney(monthlyEff)}</span> starting <span className="font-bold text-navy">one month from start date</span>.
              </div>
            </div>

            {error && <div className="md:col-span-2 text-sm text-destructive">{error}</div>}

            <div className="md:col-span-2 flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => router.push("/subscriptions")} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-light text-white">
                {isPending ? "Onboarding…" : `Create invoice + subscription`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
