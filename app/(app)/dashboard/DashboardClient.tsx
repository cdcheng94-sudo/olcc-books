"use client";

import { TrendingUp, TrendingDown, Wallet, AlertCircle, Clock, BarChart3, PieChart, History, ArrowRight, Landmark, Briefcase, Coins, HeartHandshake } from "lucide-react";
import Link from "next/link";
import { useLang } from "@/components/LangProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, fmtMoney } from "@/lib/format";
import { localizedDaysLabel, urgencyClasses } from "@/lib/recurring-utils";
import { MonthlyBarChart } from "@/components/charts/MonthlyBarChart";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { RecentTransactionsList } from "@/components/RecentTransactionsList";
import type { MonthlySummary } from "@/lib/queries/transactions";
import type { RecurringWithUrgency } from "@/lib/queries/recurring";
import type { SubscriptionWithUrgency } from "@/lib/queries/subscriptions";
import type { CareItem } from "@/lib/queries/care";
import type { MonthlyTrendPoint, CategorySlice } from "@/lib/queries/dashboard";
import type { FundPools } from "@/lib/queries/capital";
import type { TransactionRow } from "@/lib/types";

type Props = {
  summary:    MonthlySummary;
  toPay:      RecurringWithUrgency[];
  toCollect:  SubscriptionWithUrgency[];
  careDue:    CareItem[];
  trend:      MonthlyTrendPoint[];
  byCategory: CategorySlice[];
  recent:     TransactionRow[];
  pools:      FundPools;
};

export function DashboardClient({ summary, toPay, toCollect, careDue, trend, byCategory, recent, pools }: Props) {
  const { t } = useLang();

  const stat = (label: string, value: number, color: string, bg: string, Icon: React.ComponentType<{ size?: number }>) => (
    <Card>
      <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
        <CardTitle className="text-xs text-muted-foreground font-normal">
          {t.dashboard.thisMonth} · {label}
        </CardTitle>
        <div className={"w-9 h-9 rounded-md flex items-center justify-center " + bg}>
          <Icon size={18} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={"text-2xl font-bold " + color}>{fmtMoney(value)}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{t.capital.operatingOnly}</div>
      </CardContent>
    </Card>
  );

  const toCollectUrgent = toCollect.filter((s) => s.days_until_due <= 0).length;
  const toPayUrgent     = toPay.filter((r) => r.days_until_due <= 0).length;

  return (
    <div>
      {/* Greeting */}
      <div className="mb-6">
        <div className="text-sm text-muted-foreground">{t.common.greeting} 👋</div>
      </div>

      {/* Needs attention — three equal reminder columns, up top */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* To Collect (customers owe us) */}
        <Card className="h-full">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <AlertCircle size={18} className="text-gold" />
            <CardTitle className="text-sm font-bold">{t.dashboard.toCollect}</CardTitle>
            {toCollectUrgent > 0 && (
              <span className="ml-auto bg-danger-soft text-danger px-2 py-0.5 rounded-full text-[10px] font-bold">
                {toCollectUrgent} {t.dashboard.urgent}
              </span>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {toCollect.length === 0 ? (
              <Link href="/subscriptions" className="text-xs text-muted-foreground italic hover:text-navy underline">
                {t.dashboard.emptySub}
              </Link>
            ) : (
              <div className="flex flex-col gap-2">
                {toCollect.map((s) => {
                  const u = urgencyClasses(s.urgency);
                  return (
                    <div key={s.id} className="flex bg-card border border-border rounded-md overflow-hidden shadow-sm">
                      <div className={`w-1.5 ${u.bar}`} />
                      <div className="flex-1 px-3 py-2.5 flex justify-between items-center">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{s.customer_name}</div>
                          <div className="text-xs text-muted-foreground truncate">{s.service_desc}</div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className="font-bold text-sm tabular-nums">{fmtMoney(+(s.amount * (1 - (s.discount_percent || 0) / 100)).toFixed(2))}</div>
                          <div className={`text-[11px] font-semibold ${u.text}`}>{localizedDaysLabel(s.days_until_due, t)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* To Pay (we owe vendors) */}
        <Card className="h-full">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Clock size={18} className="text-gold" />
            <CardTitle className="text-sm font-bold">{t.dashboard.toPay}</CardTitle>
            {toPayUrgent > 0 && (
              <span className="ml-auto bg-danger-soft text-danger px-2 py-0.5 rounded-full text-[10px] font-bold">
                {toPayUrgent} {t.dashboard.urgent}
              </span>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {toPay.length === 0 ? (
              <Link href="/recurring" className="text-xs text-muted-foreground italic hover:text-navy underline">
                {t.dashboard.emptyRec}
              </Link>
            ) : (
              <div className="flex flex-col gap-2">
                {toPay.map((r) => {
                  const u = urgencyClasses(r.urgency);
                  return (
                    <div key={r.id} className="flex bg-card border border-border rounded-md overflow-hidden shadow-sm">
                      <div className={`w-1.5 ${u.bar}`} />
                      <div className="flex-1 px-3 py-2.5 flex justify-between items-center">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{r.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{r.payee || fmtDate(r.next_due_date)}</div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className="font-bold text-sm tabular-nums">{fmtMoney(r.amount)}</div>
                          <div className={`text-[11px] font-semibold ${u.text}`}>{localizedDaysLabel(r.days_until_due, t)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customers to check in (after-sales care) */}
        <Card className="h-full">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <HeartHandshake size={18} className="text-gold" />
            <CardTitle className="text-sm font-bold">{t.dashboard.careTitle}</CardTitle>
            {careDue.length > 0 && (
              <span className="ml-auto bg-danger-soft text-danger px-2 py-0.5 rounded-full text-[10px] font-bold">
                {careDue.length}
              </span>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {careDue.length === 0 ? (
              <Link href="/care" className="text-xs text-muted-foreground italic hover:text-navy underline">
                {t.dashboard.careEmpty}
              </Link>
            ) : (
              <div className="flex flex-col gap-2">
                {careDue.map((c) => {
                  const u = c.checkin_urgency ? urgencyClasses(c.checkin_urgency) : null;
                  return (
                    <Link key={c.id} href="/care" className="flex bg-card border border-border rounded-md overflow-hidden shadow-sm hover:border-gold">
                      <div className={`w-1.5 ${u ? u.bar : "bg-warning"}`} />
                      <div className="flex-1 px-3 py-2.5 flex justify-between items-center min-w-0">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{c.customer_name}</div>
                          <div className="text-xs text-muted-foreground truncate">{c.service_desc}</div>
                        </div>
                        <div className={`text-[11px] font-semibold shrink-0 ml-3 ${u ? u.text : "text-warning"}`}>
                          {c.days_until_checkin != null ? localizedDaysLabel(c.days_until_checkin, t) : ""}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Company funds (hero) — Capital + Operating shown small underneath */}
      <Card className="mb-6">
        <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2">
          <Coins size={18} className="text-gold" />
          <CardTitle className="text-sm font-bold">{t.dashboard.totalAvailableFunds}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* hero: total = bank balance */}
          <div className="text-4xl font-bold text-navy tabular-nums leading-none">{fmtMoney(pools.total)}</div>
          <div className="text-[11px] text-muted-foreground mt-1.5">{t.dashboard.matchesBank}</div>

          {/* small breakdown: where the money came from */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-md border border-primary/20 bg-primary/[0.04] px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Landmark size={13} className="text-navy" />
                <span className="text-[11px] font-semibold text-navy">{t.dashboard.capitalPool}</span>
              </div>
              <div className="text-base font-bold text-navy tabular-nums">{fmtMoney(pools.capitalPool)}</div>
              <div className="text-[10px] text-muted-foreground">{t.capital.capitalPoolDesc}</div>
            </div>
            <div className="rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Briefcase size={13} className="text-gold" />
                <span className="text-[11px] font-semibold" style={{ color: "hsl(var(--gold))" }}>{t.dashboard.operatingPool}</span>
              </div>
              <div className="text-base font-bold tabular-nums" style={{ color: "hsl(var(--gold))" }}>{fmtMoney(pools.operatingPool)}</div>
              <div className="text-[10px] text-muted-foreground">{t.capital.operatingPoolDesc}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards (Operating / P&L only) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stat(t.dashboard.income,  summary.income,  "text-success", "bg-success-soft text-success", TrendingUp)}
        {stat(t.dashboard.expense, summary.expense, "text-danger",  "bg-danger-soft text-danger",   TrendingDown)}
        {stat(t.dashboard.net,     summary.net,     summary.net >= 0 ? "text-navy" : "text-danger", "bg-accent text-navy", Wallet)}
      </div>

      {/* 6-month trend */}
      <Card className="mb-6">
        <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3">
          <BarChart3 size={18} className="text-gold" />
          <CardTitle className="text-sm font-bold">{t.dashboard.trend6Months}</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyBarChart data={trend} />
          <div className="text-[11px] text-muted-foreground italic mt-1 text-center">{t.dashboard.cashflowCaption}</div>
        </CardContent>
      </Card>

      {/* Expense breakdown + Recent transactions */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-6">
        <Card className="md:col-span-5">
          <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3">
            <PieChart size={18} className="text-gold" />
            <CardTitle className="text-sm font-bold">{t.dashboard.expenseByCat}</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart data={byCategory} />
          </CardContent>
        </Card>

        <Card className="md:col-span-7">
          <CardHeader className="flex-row items-center gap-2 space-y-0 pb-1">
            <History size={18} className="text-gold" />
            <CardTitle className="text-sm font-bold">{t.dashboard.recentTx}</CardTitle>
            <Link
              href="/transactions"
              className="ml-auto text-[11px] text-muted-foreground hover:text-navy flex items-center gap-0.5 font-medium"
            >
              {t.dashboard.viewAll}
              <ArrowRight size={12} />
            </Link>
          </CardHeader>
          <CardContent className="pt-1">
            <RecentTransactionsList rows={recent} />
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
