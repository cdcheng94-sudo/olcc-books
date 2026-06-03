"use client";

import { useState } from "react";
import Link from "next/link";
import { Landmark, ArrowDownCircle, ArrowUpCircle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLang } from "@/components/LangProvider";
import { fmtDate, fmtMoney } from "@/lib/format";
import { CAPITAL_CATEGORIES } from "@/lib/categories";
import type { TransactionRow } from "@/lib/types";
import type { CapitalTotals, ShareholderSummary } from "@/lib/queries/capital";

type Row = TransactionRow & { shareholder_name: string | null };

type Props = {
  totals:          CapitalTotals;
  byShareholder:   ShareholderSummary[];
  loansIn:         Row[];
  repayments:      Row[];
  capitalExpenses: Row[];
  interestPaid:    Row[];
};

type TabKey = "loansIn" | "repayments" | "capitalExp" | "interest" | "byShareholder";

export function CapitalClient({ totals, byShareholder, loansIn, repayments, capitalExpenses, interestPaid }: Props) {
  const { t } = useLang();
  const [tab, setTab] = useState<TabKey>("loansIn");

  const tabs: { key: TabKey; label: string; addType?: string }[] = [
    { key: "loansIn",       label: t.capital.tabLoansIn,       addType: "capital_injection" },
    { key: "repayments",    label: t.capital.tabRepayments,    addType: "loan_repayment" },
    { key: "capitalExp",    label: t.capital.tabCapitalExp,    addType: "capital_expense" },
    { key: "interest",      label: t.capital.tabInterest,      addType: "interest_paid" },
    { key: "byShareholder", label: t.capital.tabByShareholder },
  ];

  const capLabel = (key: string | null) =>
    key && (CAPITAL_CATEGORIES as readonly string[]).includes(key)
      ? t.capitalCat[key as keyof typeof t.capitalCat] : (key || "—");

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Landmark size={20} className="text-gold" />
          {t.capital.pageTitle}
        </h2>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Info size={12} /> {t.capital.readonlyHint}
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={<ArrowDownCircle size={18} />} label={t.capital.totalBorrowed} value={totals.totalBorrowed} color="text-navy" bg="bg-primary/10 text-navy" />
        <StatCard icon={<ArrowUpCircle size={18} />}   label={t.capital.totalRepaid}   value={totals.totalRepaid}   color="text-success" bg="bg-success-soft text-success" />
        <StatCard icon={<Landmark size={18} />}        label={t.capital.outstanding}   value={totals.outstanding}   color="text-gold" bg="bg-accent text-navy" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " +
              (tab === tb.key ? "bg-navy text-white border-navy" : "bg-card text-muted-foreground border-border hover:text-navy")}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* Add button (jumps to /transactions with type pre-selected) */}
      {tab !== "byShareholder" && (
        <div className="mb-3">
          <Link href={`/transactions?new=${tabs.find((x) => x.key === tab)?.addType}`}>
            <Button variant="outline" className="border-gold text-navy hover:bg-gold/10">{t.capital.addVia}</Button>
          </Link>
        </div>
      )}

      <Card>
        {tab === "loansIn"       && <LoansInTable rows={loansIn} t={t} />}
        {tab === "repayments"    && <RepaymentsTable rows={repayments} t={t} />}
        {tab === "capitalExp"    && <CapitalExpTable rows={capitalExpenses} t={t} capLabel={capLabel} />}
        {tab === "interest"      && <InterestTable rows={interestPaid} t={t} />}
        {tab === "byShareholder" && <ByShareholderTable rows={byShareholder} t={t} />}
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: number; color: string; bg: string }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
        <CardTitle className="text-xs text-muted-foreground font-normal">{label}</CardTitle>
        <div className={"w-9 h-9 rounded-md flex items-center justify-center " + bg}>{icon}</div>
      </CardHeader>
      <CardContent><div className={"text-2xl font-bold " + color}>{fmtMoney(value)}</div></CardContent>
    </Card>
  );
}

type T = ReturnType<typeof useLang>["t"];

function Empty({ t }: { t: T }) {
  return <tr><td colSpan={6} className="text-center text-muted-foreground italic py-12">{t.capital.noRecords}</td></tr>;
}
const TH = "text-left px-4 py-3 font-medium";
const THEAD = "bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground";

function LoansInTable({ rows, t }: { rows: Row[]; t: T }) {
  return (
    <table className="w-full text-sm">
      <thead className={THEAD}><tr>
        <th className={TH + " w-[110px]"}>{t.tx.date}</th>
        <th className={TH}>{t.capital.shareholder}</th>
        <th className={TH + " w-[140px]"}>{t.capital.loanTypeCol}</th>
        <th className={"text-right px-4 py-3 font-medium w-[140px]"}>{t.tx.amount}</th>
        <th className={TH}>{t.tx.note}</th>
      </tr></thead>
      <tbody>
        {rows.length === 0 ? <Empty t={t} /> : rows.map((r) => (
          <tr key={r.id} className="border-t border-border hover:bg-muted/20">
            <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
            <td className="px-4 py-3 font-medium">{r.shareholder_name || "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{r.loan_type ? t.loanType[r.loan_type as keyof typeof t.loanType] : "—"}</td>
            <td className="px-4 py-3 text-right tabular-nums font-semibold text-navy">{fmtMoney(r.amount)}</td>
            <td className="px-4 py-3 text-muted-foreground">{r.note || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RepaymentsTable({ rows, t }: { rows: Row[]; t: T }) {
  return (
    <table className="w-full text-sm">
      <thead className={THEAD}><tr>
        <th className={TH + " w-[110px]"}>{t.tx.date}</th>
        <th className={TH}>{t.capital.shareholder}</th>
        <th className={"text-right px-4 py-3 font-medium w-[140px]"}>{t.tx.amount}</th>
        <th className={TH}>{t.tx.note}</th>
      </tr></thead>
      <tbody>
        {rows.length === 0 ? <Empty t={t} /> : rows.map((r) => (
          <tr key={r.id} className="border-t border-border hover:bg-muted/20">
            <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
            <td className="px-4 py-3 font-medium">{r.shareholder_name || "—"}</td>
            <td className="px-4 py-3 text-right tabular-nums font-semibold text-success">{fmtMoney(r.amount)}</td>
            <td className="px-4 py-3 text-muted-foreground">{r.note || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CapitalExpTable({ rows, t, capLabel }: { rows: Row[]; t: T; capLabel: (k: string | null) => string }) {
  return (
    <table className="w-full text-sm">
      <thead className={THEAD}><tr>
        <th className={TH + " w-[110px]"}>{t.tx.date}</th>
        <th className={TH + " w-[160px]"}>{t.tx.category}</th>
        <th className={TH}>{t.tx.party}</th>
        <th className={"text-right px-4 py-3 font-medium w-[140px]"}>{t.tx.amount}</th>
        <th className={TH}>{t.tx.note}</th>
      </tr></thead>
      <tbody>
        {rows.length === 0 ? <Empty t={t} /> : rows.map((r) => (
          <tr key={r.id} className="border-t border-border hover:bg-muted/20">
            <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
            <td className="px-4 py-3">{capLabel(r.category)}</td>
            <td className="px-4 py-3 text-muted-foreground">{r.party || "—"}</td>
            <td className="px-4 py-3 text-right tabular-nums font-semibold text-warning">{fmtMoney(r.amount)}</td>
            <td className="px-4 py-3 text-muted-foreground">{r.note || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InterestTable({ rows, t }: { rows: Row[]; t: T }) {
  return (
    <table className="w-full text-sm">
      <thead className={THEAD}><tr>
        <th className={TH + " w-[110px]"}>{t.tx.date}</th>
        <th className={TH}>{t.capital.shareholder}</th>
        <th className={TH}>{t.capital.periodNote}</th>
        <th className={"text-right px-4 py-3 font-medium w-[140px]"}>{t.tx.amount}</th>
      </tr></thead>
      <tbody>
        {rows.length === 0 ? <Empty t={t} /> : rows.map((r) => (
          <tr key={r.id} className="border-t border-border hover:bg-muted/20">
            <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
            <td className="px-4 py-3 font-medium">{r.shareholder_name || "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{r.note || "—"}</td>
            <td className="px-4 py-3 text-right tabular-nums font-semibold text-rose-600">{fmtMoney(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ByShareholderTable({ rows, t }: { rows: ShareholderSummary[]; t: T }) {
  return (
    <table className="w-full text-sm">
      <thead className={THEAD}><tr>
        <th className={TH}>{t.capital.shareholder}</th>
        <th className={"text-right px-4 py-3 font-medium"}>{t.capital.totalBorrowed}</th>
        <th className={"text-right px-4 py-3 font-medium"}>{t.capital.totalRepaid}</th>
        <th className={"text-right px-4 py-3 font-medium"}>{t.capital.interestReceived}</th>
        <th className={"text-right px-4 py-3 font-medium"}>{t.capital.outstanding}</th>
      </tr></thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={5} className="text-center text-muted-foreground italic py-12">{t.capital.noRecords}</td></tr>
        ) : rows.map((s) => (
          <tr key={s.id} className="border-t border-border hover:bg-muted/20">
            <td className="px-4 py-3 font-medium">{s.name}</td>
            <td className="px-4 py-3 text-right tabular-nums text-navy">{fmtMoney(s.totalBorrowed)}</td>
            <td className="px-4 py-3 text-right tabular-nums text-success">{fmtMoney(s.totalRepaid)}</td>
            <td className="px-4 py-3 text-right tabular-nums text-rose-600">{fmtMoney(s.interestReceived)}</td>
            <td className="px-4 py-3 text-right tabular-nums font-bold text-gold">{fmtMoney(s.outstanding)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
