"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useLang } from "@/components/LangProvider";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { TransactionRow } from "@/lib/types";

export function RecentTransactionsList({ rows }: { rows: TransactionRow[] }) {
  const { t } = useLang();
  if (rows.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-6 text-center">
        {t.dashboard.noTxYet}
        <Link href="/transactions" className="underline hover:text-navy">{t.dashboard.addFirst}</Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {rows.map((tx, i) => {
        // inflow = money into the company (income, shareholder loan, equity)
        const isIncome = tx.type === "income" || tx.type === "shareholder_loan" || tx.type === "capital_injection";
        return (
          <li
            key={tx.id}
            className={
              "flex items-center gap-3 py-2 " +
              (i > 0 ? "border-t border-border" : "")
            }
          >
            <div
              className={
                "w-7 h-7 rounded-md flex items-center justify-center shrink-0 " +
                (isIncome ? "bg-success-soft text-success" : "bg-danger-soft text-danger")
              }
            >
              {isIncome ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{tx.party || tx.category}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {tx.category} · {fmtDate(tx.date)}
              </div>
            </div>
            <div
              className={
                "text-sm font-semibold tabular-nums shrink-0 " +
                (isIncome ? "text-success" : "text-danger")
              }
            >
              {isIncome ? "+" : "−"}{fmtMoney(tx.amount)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
