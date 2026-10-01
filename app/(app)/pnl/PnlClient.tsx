"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, Scale, Percent, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLang } from "@/components/LangProvider";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { INTEREST_KEY, type PnlLine, type PnlReport } from "@/lib/queries/pnl";

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Table cells drop the currency prefix (many columns) and show a dash for zero. */
function cell(n: number): string {
  if (n === 0) return "—";
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(net: number, income: number): string {
  return income > 0 ? `${((net / income) * 100).toFixed(1)}%` : "—";
}
/** "2026-04" shifted by n months. */
function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// First column stays put while the months scroll sideways.
const STICKY = "sticky left-0 z-10 text-left px-4 py-2.5";
const NUM = "px-3 py-2.5 text-right tabular-nums whitespace-nowrap";

export function PnlClient({ report, thisMonth }: { report: PnlReport; thisMonth: string }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const { totals, months } = report;
  const hasData = report.income.length > 0 || report.expense.length > 0;

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return lang === "zh" ? `${y}年${m}月` : `${EN_MONTHS[m - 1]} ${y}`;
  };
  const lineLabel = (key: string) => (key === INTEREST_KEY ? t.txType.interest_paid : key);
  const href = (from: string, to: string) => `/pnl?from=${from}&to=${to}`;

  const year = thisMonth.slice(0, 4);
  const lastYear = String(Number(year) - 1);
  const quick: { label: string; from: string; to: string }[] = [
    { label: t.pnl.thisYear, from: `${year}-01`,              to: thisMonth },
    { label: t.pnl.lastYear, from: `${lastYear}-01`,          to: `${lastYear}-12` },
    { label: t.pnl.last12,   from: shiftMonth(thisMonth, -11), to: thisMonth },
    { label: t.pnl.allTime,  from: report.firstMonth ?? thisMonth, to: thisMonth },
  ];

  function setRange(from: string, to: string) {
    if (YM.test(from) && YM.test(to)) router.push(href(from, to));
  }

  function downloadCsv() {
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const num = (n: number) => n.toFixed(2);
    const row = (label: string, values: number[], total: number) => [q(label), ...values.map(num), num(total)].join(",");
    const lines = [
      [q(t.pnl.item), ...months.map((m) => q(monthLabel(m))), q(t.pnl.total)].join(","),
      ...report.income.map((l) => row(lineLabel(l.key), l.values, l.total)),
      row(t.pnl.totalRevenue, report.incomeByMonth, totals.income),
      ...report.expense.map((l) => row(lineLabel(l.key), l.values, l.total)),
      row(t.pnl.totalExpenses, report.expenseByMonth, totals.expense),
      row(t.pnl.netProfit, report.netByMonth, totals.net),
    ];
    // BOM so Excel opens the Chinese labels as UTF-8.
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `olcc-pnl_${report.from}_${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      {/* period bar */}
      <Card className="mb-5">
        <CardContent className="p-4 flex items-end gap-x-5 gap-y-3 flex-wrap">
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">{t.pnl.quickPeriod}</div>
            <div className="flex gap-1.5 flex-wrap">
              {quick.map((p) => (
                <Link
                  key={p.label}
                  href={href(p.from, p.to)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                    p.from === report.from && p.to === report.to
                      ? "bg-navy text-white border-navy"
                      : "bg-card text-muted-foreground border-border hover:text-navy",
                  )}
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{t.pnl.from}</span>
            <input type="month" value={report.from} max={report.to}
              onChange={(e) => setRange(e.target.value, report.to)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{t.pnl.to}</span>
            <input type="month" value={report.to} min={report.from}
              onChange={(e) => setRange(report.from, e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
          </label>
          <Button type="button" variant="outline" onClick={downloadCsv} disabled={!hasData} className="ml-auto">
            <Download className="w-4 h-4 mr-1.5" />CSV
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat icon={<TrendingUp size={18} />}   label={t.pnl.totalRevenue}  value={fmtMoney(totals.income)}  tone="text-success" chip="bg-success-soft text-success" />
        <Stat icon={<TrendingDown size={18} />} label={t.pnl.totalExpenses} value={fmtMoney(totals.expense)} tone="text-danger"  chip="bg-danger-soft text-danger" />
        <Stat icon={<Scale size={18} />}        label={t.pnl.netProfit}     value={fmtMoney(totals.net)}     tone={totals.net >= 0 ? "text-navy" : "text-danger"} chip="bg-primary/10 text-navy" />
        <Stat icon={<Percent size={18} />}      label={t.pnl.margin}        value={pct(totals.net, totals.income)} tone="text-navy" chip="bg-gold/15 text-gold" />
      </div>

      <Card className="overflow-hidden">
        {!hasData ? (
          <CardContent className="py-12 text-center text-sm text-muted-foreground italic">{t.pnl.empty}</CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 230 + (months.length + 1) * 112 }}>
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className={cn(STICKY, "bg-card font-medium min-w-[200px]")}>{t.pnl.item}</th>
                  {months.map((m) => <th key={m} className={cn(NUM, "font-medium")}>{monthLabel(m)}</th>)}
                  <th className={cn(NUM, "font-bold text-foreground")}>{t.pnl.total}</th>
                </tr>
              </thead>
              <tbody>
                {report.income.map((l) => <LineRow key={l.key} line={l} label={lineLabel(l.key)} tone="" />)}
                <BandRow label={t.pnl.totalRevenue} values={report.incomeByMonth} total={totals.income} tone="text-success" />

                {report.expense.map((l) => <LineRow key={l.key} line={l} label={lineLabel(l.key)} tone="text-danger" indent />)}
                <BandRow label={t.pnl.totalExpenses} values={report.expenseByMonth} total={totals.expense} tone="text-foreground" />

                <tr className="border-t-2 border-gold/50">
                  <td className={cn(STICKY, "bg-[#fdf8e7] font-bold uppercase tracking-wide")}>{t.pnl.netProfit}</td>
                  {report.netByMonth.map((v, i) => (
                    <td key={i} className={cn(NUM, "bg-[#fdf8e7] font-bold", v < 0 ? "text-danger" : "text-success")}>
                      {report.incomeByMonth[i] === 0 && report.expenseByMonth[i] === 0 ? "—" : v.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  ))}
                  <td className={cn(NUM, "bg-[#fdf8e7] font-bold", totals.net < 0 ? "text-danger" : "text-success")}>
                    {totals.net.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="border-t border-border">
                  <td className={cn(STICKY, "bg-card text-xs text-muted-foreground")}>{t.pnl.margin}</td>
                  {report.netByMonth.map((v, i) => (
                    <td key={i} className={cn(NUM, "text-xs text-muted-foreground")}>{pct(v, report.incomeByMonth[i])}</td>
                  ))}
                  <td className={cn(NUM, "text-xs text-muted-foreground")}>{pct(totals.net, totals.income)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-muted-foreground mt-3 max-w-3xl">{t.pnl.basisHint} {t.pnl.prepaidNote}</p>
    </div>
  );
}

function Stat({ icon, label, value, tone, chip }: { icon: React.ReactNode; label: string; value: string; tone: string; chip: string }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
        <CardTitle className="text-xs text-muted-foreground font-normal">{label}</CardTitle>
        <div className={"w-9 h-9 rounded-md flex items-center justify-center " + chip}>{icon}</div>
      </CardHeader>
      <CardContent><div className={"text-xl sm:text-2xl font-bold tabular-nums " + tone}>{value}</div></CardContent>
    </Card>
  );
}

/** One category. Expense lines are indented and red, like a printed P&L. */
function LineRow({ line, label, tone, indent }: { line: PnlLine; label: string; tone: string; indent?: boolean }) {
  return (
    <tr className="border-t border-border">
      <td className={cn(STICKY, "bg-card", indent && "pl-8")}>{label}</td>
      {line.values.map((v, i) => (
        <td key={i} className={cn(NUM, v === 0 ? "text-muted-foreground/60" : tone)}>{cell(v)}</td>
      ))}
      <td className={cn(NUM, "font-semibold", tone)}>{cell(line.total)}</td>
    </tr>
  );
}

/** Shaded subtotal band (Total revenue / Total expenses). */
function BandRow({ label, values, total, tone }: { label: string; values: number[]; total: number; tone: string }) {
  return (
    <tr className="border-t border-border">
      <td className={cn(STICKY, "bg-muted font-semibold")}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className={cn(NUM, "bg-muted font-semibold", v === 0 ? "text-muted-foreground/60" : tone)}>{cell(v)}</td>
      ))}
      <td className={cn(NUM, "bg-muted font-bold", tone)}>{cell(total)}</td>
    </tr>
  );
}
