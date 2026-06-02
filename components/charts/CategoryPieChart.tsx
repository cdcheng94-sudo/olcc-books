"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useLang } from "@/components/LangProvider";
import type { CategorySlice } from "@/lib/queries/dashboard";
import { fmtMoney } from "@/lib/format";

/**
 * Donut chart of expenses by category for one month, with a legend
 * to the right. Colors cycle through the 5 chart CSS vars; if more
 * than 5 categories show up we wrap (rare for an SMB month).
 */
const SLICE_COLORS = [
  "hsl(var(--chart-2))",  // expense red
  "hsl(var(--chart-3))",  // navy
  "hsl(var(--chart-4))",  // gold
  "hsl(var(--chart-5))",  // navy light
  "hsl(var(--chart-1))",  // green (last resort)
];

export function CategoryPieChart({ data }: { data: CategorySlice[] }) {
  const { t } = useLang();
  if (data.length === 0) {
    return (
      <div className="w-full h-[220px] flex items-center justify-center text-xs text-muted-foreground italic">
        {t.dashboard.noExpenseMonth}
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="flex items-center gap-4 w-full">
      <div className="w-[180px] h-[180px] shrink-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={72}
              paddingAngle={2}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, name) => [fmtMoney(Number(value) || 0), String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.dashboard.total}</div>
          <div className="text-sm font-bold tabular-nums">{fmtMoney(total)}</div>
        </div>
      </div>
      <ul className="flex-1 flex flex-col gap-1.5 text-xs">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.amount / total) * 100 : 0;
          return (
            <li key={d.category} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
              />
              <span className="flex-1 truncate text-foreground">{d.category}</span>
              <span className="tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
              <span className="tabular-nums font-medium w-[78px] text-right">{fmtMoney(d.amount)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
