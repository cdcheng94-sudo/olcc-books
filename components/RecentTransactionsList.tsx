"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { TransactionRow } from "@/lib/types";

/**
 * Compact "what just happened" list for the Dashboard. Always renders
 * up to 8 rows; if empty, hints the user to add one. Icons mirror the
 * stat-card metaphor: green up = income, red down = expense.
 */
export function RecentTransactionsList({ rows }: { rows: TransactionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-6 text-center">
        No transactions yet —{" "}
        <Link href="/transactions" className="underline hover:text-navy">add the first one</Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {rows.map((tx, i) => {
        const isIncome = tx.type === "income";
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
