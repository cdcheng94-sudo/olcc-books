"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, GraduationCap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/components/LangProvider";
import { interp } from "@/lib/i18n";
import { fmtMoney, todayIso } from "@/lib/format";
import { EDUFLOW_PLAN_LIST, EDUFLOW_PLANS, type EduFlowPlanKey } from "@/lib/eduflow-plans";
import { onboardEduFlowCustomer } from "./actions";

/**
 * Single-form onboarding flow for an EduFlow customer:
 *   pick plan → enter customer info → submit → invoice + subscription
 *   created in one shot, then redirected to /invoices for review.
 */

export function EduFlowClient() {
  const { t } = useLang();
  const router = useRouter();
  const [planKey, setPlanKey] = useState<EduFlowPlanKey>("professional");
  const [customerName,    setCustomerName]    = useState("");
  const [customerEmail,   setCustomerEmail]   = useState("");
  const [customerPhone,   setCustomerPhone]   = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [startDate,       setStartDate]       = useState(todayIso());
  const [monthlyOverride, setMonthlyOverride] = useState("");
  const [setupOverride,   setSetupOverride]   = useState("");
  const [discount,        setDiscount]        = useState("");
  const [firstFree,       setFirstFree]       = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const plan = EDUFLOW_PLANS[planKey];
  const monthlyEff = useMemo(() => Number(monthlyOverride || plan.monthly), [monthlyOverride, plan.monthly]);
  const setupEff   = useMemo(() => Number(setupOverride   || plan.setup),   [setupOverride,   plan.setup]);
  const discountPct = useMemo(() => Math.min(100, Math.max(0, Number(discount) || 0)), [discount]);
  const firstFreeEff = firstFree ?? plan.firstMonthFree;
  const grossInvoice = setupEff + (firstFreeEff ? 0 : monthlyEff);
  const discountAmt  = grossInvoice * (discountPct / 100);
  const firstInvoiceTotal = grossInvoice - discountAmt;

  function pickPlan(k: EduFlowPlanKey) {
    setPlanKey(k);
    setMonthlyOverride("");
    setSetupOverride("");
    setDiscount("");
    setFirstFree(null);
  }

  function submit() {
    setError(null);
    if (!customerName.trim()) { setError(t.eduflow.formCustomerName); return; }
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
          discount_percent: discountPct > 0 ? discountPct : undefined,
        });
        alert(interp(t.eduflow.successTemplate, {
          name:         customerName,
          invoiceTotal: fmtMoney(firstInvoiceTotal),
          monthly:      fmtMoney(monthlyEff),
        }));
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
          {t.eduflow.title}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {t.eduflow.subtitle}
        </p>
      </div>

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
              {selected && <div className="absolute top-0 left-0 right-0 h-1.5 bg-gold rounded-t-[0.4rem]" />}
              {isPro && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-primary-deep text-[10px] font-bold tracking-wider px-3 py-0.5 rounded-full uppercase">
                  {t.eduflow.mostPopular}
                </span>
              )}
              <div className="flex items-center gap-1.5 mb-1">
                <div className="text-base font-bold text-navy">{t.eduflow.plans[p.key].label}</div>
                {selected && (
                  <span className="ml-auto bg-gold text-primary-deep rounded-full w-5 h-5 flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mb-3 min-h-[28px]">{t.eduflow.plans[p.key].audience}</div>
              <div className="text-2xl font-bold text-navy">{fmtMoney(p.monthly)}<span className="text-xs text-muted-foreground font-normal"> {t.eduflow.perMo}</span></div>
              <div className="text-xs text-muted-foreground mb-3">{t.eduflow.setupPrefix}{fmtMoney(p.setup)} {p.enterpriseEditable ? <span className="italic">{t.eduflow.startsAt}</span> : null}</div>
              {p.firstMonthFree && (
                <div className="inline-block bg-success-soft text-success text-[10px] font-bold px-2 py-0.5 rounded-full mb-3 uppercase tracking-wide">
                  {t.eduflow.firstMonthFree}
                </div>
              )}
              <ul className="text-xs text-muted-foreground flex flex-col gap-1 mt-2">
                {t.eduflow.plans[p.key].features.slice(0, 4).map((f, i) => (
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Sparkles size={16} className="text-gold" />
            {t.eduflow.customerDetails}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 md:col-span-2">
              <Label className="text-xs">{t.eduflow.formCustomerName}</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required placeholder={t.eduflow.formCustomerNamePlaceholder} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.eduflow.formEmail}</Label>
              <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder={t.eduflow.formEmailPlaceholder} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.eduflow.formPhone}</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder={t.eduflow.formPhonePlaceholder} />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <Label className="text-xs">{t.eduflow.formAddress}</Label>
              <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.eduflow.formStartDate}</Label>
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
                <span>{t.eduflow.formFirstFree}</span>
                <span className="text-[10px] text-muted-foreground">
                  {plan.firstMonthFree ? interp(t.eduflow.formDefaultFor, { plan: t.eduflow.plans[planKey].label }) : ""}
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">
                {t.eduflow.formMonthlyOverride} <span className="text-muted-foreground">{t.eduflow.formOverrideHint}</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={monthlyOverride}
                onChange={(e) => setMonthlyOverride(e.target.value)}
                placeholder={`${t.eduflow.formDefaultPrefix}${plan.monthly}`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">
                {t.eduflow.formSetupOverride} <span className="text-muted-foreground">{t.eduflow.formOverrideHint}</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={setupOverride}
                onChange={(e) => setSetupOverride(e.target.value)}
                placeholder={`${t.eduflow.formDefaultPrefix}${plan.setup}`}
              />
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <Label className="text-xs">
                {t.eduflow.formDiscount} <span className="text-muted-foreground">{t.eduflow.formDiscountHint}</span>
              </Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="md:col-span-2 bg-muted/30 rounded-md p-4 text-sm">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold mb-2">{t.eduflow.summaryWillInclude}</div>
              <div className="flex justify-between text-xs">
                <span>{interp(t.eduflow.summarySetup, { plan: t.eduflow.plans[planKey].label })}</span>
                <span className="tabular-nums">{fmtMoney(setupEff)}</span>
              </div>
              {!firstFreeEff && (
                <div className="flex justify-between text-xs">
                  <span>{interp(t.eduflow.summaryFirstMonth, { plan: t.eduflow.plans[planKey].label })}</span>
                  <span className="tabular-nums">{fmtMoney(monthlyEff)}</span>
                </div>
              )}
              {firstFreeEff && (
                <div className="flex justify-between text-xs text-success">
                  <span>{interp(t.eduflow.summaryFirstMonth, { plan: t.eduflow.plans[planKey].label })}</span>
                  <span className="font-bold">{t.eduflow.summaryFree}</span>
                </div>
              )}
              {discountPct > 0 && (
                <div className="flex justify-between text-xs text-destructive">
                  <span>{t.eduflow.summaryDiscount} ({discountPct}%)</span>
                  <span className="tabular-nums font-bold">−{fmtMoney(discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border mt-2 pt-2 text-sm font-bold">
                <span>{t.eduflow.summaryTotal}</span>
                <span className="tabular-nums text-navy">{fmtMoney(firstInvoiceTotal)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">
                {t.eduflow.summaryPlusMonthly}<span className="font-bold text-navy">{fmtMoney(monthlyEff)}</span>{t.eduflow.summaryMonthlyOf}<span className="font-bold text-navy">{t.eduflow.summaryStartingOne}</span>{t.eduflow.summaryEnding}
              </div>
            </div>

            {error && <div className="md:col-span-2 text-sm text-destructive">{error}</div>}

            <div className="md:col-span-2 flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => router.push("/subscriptions")} disabled={isPending}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-light text-white">
                {isPending ? t.eduflow.btnSubmitting : t.eduflow.btnSubmit}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
