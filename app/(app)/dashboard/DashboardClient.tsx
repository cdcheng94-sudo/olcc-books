"use client";

import { TrendingUp, TrendingDown, Wallet, AlertCircle, Clock, BarChart3, PieChart, History, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useLang } from "@/components/LangProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, fmtMoney } from "@/lib/format";
import { daysLabel, urgencyClasses } from "@/lib/recurring-utils";
import { MonthlyBarChart } from "@/components/charts/MonthlyBarChart";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { RecentTransactionsList } from "@/components/RecentTransactionsList";
import type { MonthlySummary } from "@/lib/queries/transactions";
import type { RecurringWithUrgency } from "@/lib/queries/recurring";
import type { SubscriptionWithUrgency } from "@/lib/queries/subscriptions";
import type { MonthlyTrendPoint, CategorySlice } from "@/lib/queries/dashboard";
import type { TransactionRow } from "@/lib/types";

type Props = {
  summary:    MonthlySummary;
  toPay:      RecurringWithUrgency[];
  toCollect:  SubscriptionWithUrgency[];
  trend:      MonthlyTrendPoint[];
  byCategory: CategorySlice[];
  recent:     TransactionRow[];
};

export function DashboardClient({ summary, toPay, toCollect, trend, byCategory, recent }: Props) {
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

      {/* Stat cards */}
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

      {/* To Collect + To Pay reminder lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
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
                {t.common.empty} — add a subscription
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
                          <div className="font-bold text-sm tabular-nums">{fmtMoney(s.amount)}</div>
                          <div className={`text-[11px] font-semibold ${u.text}`}>{daysLabel(s.days_until_due)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
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
                {t.common.empty} — add a recurring payment
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
                          <div className={`text-[11px] font-semibold ${u.text}`}>{daysLabel(r.days_until_due)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
