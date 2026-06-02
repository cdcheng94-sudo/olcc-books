"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLang } from "@/components/LangProvider";
import type { MonthlyTrendPoint } from "@/lib/queries/dashboard";
import { fmtMoney } from "@/lib/format";

export function MonthlyBarChart({ data }: { data: MonthlyTrendPoint[] }) {
  const { t } = useLang();
  const empty = data.every((d) => d.income === 0 && d.expense === 0);

  return (
    <div className="w-full h-[260px]">
      {empty ? (
        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground italic">
          {t.dashboard.noData6m}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, name) => [fmtMoney(Number(value) || 0), String(name)]}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            />
            <Bar dataKey="income"  name={t.dashboard.income}  fill="hsl(var(--success))"     radius={[4, 4, 0, 0]} maxBarSize={36} />
            <Bar dataKey="expense" name={t.dashboard.expense} fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
