"use client";

import { useMemo, useState } from "react";
import { HeartHandshake, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLang } from "@/components/LangProvider";
import { fmtDate } from "@/lib/format";
import { daysUntilDue, urgencyFor, urgencyClasses, localizedDaysLabel } from "@/lib/recurring-utils";
import type { CareItem } from "@/lib/queries/care";
import type { CustomerHealth } from "@/lib/types";
import { LogCheckInModal } from "./LogCheckInModal";

const HEALTH_BADGE: Record<CustomerHealth, string> = {
  healthy: "bg-success-soft text-success",
  watch:   "bg-warning-soft text-warning",
  at_risk: "bg-danger-soft text-danger",
};

function sortItems(items: CareItem[]): CareItem[] {
  return [...items].sort((a, b) => {
    if (a.days_until_checkin == null && b.days_until_checkin == null) return 0;
    if (a.days_until_checkin == null) return 1;
    if (b.days_until_checkin == null) return -1;
    return a.days_until_checkin - b.days_until_checkin;
  });
}

export function CareClient({ initialItems }: { initialItems: CareItem[] }) {
  const { t } = useLang();
  const [items, setItems] = useState<CareItem[]>(initialItems);
  const [active, setActive] = useState<CareItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const healthLabel: Record<CustomerHealth, string> = {
    healthy: t.care.healthHealthy, watch: t.care.healthWatch, at_risk: t.care.healthAtRisk,
  };

  const rows = useMemo(() => sortItems(items), [items]);

  function openLog(item: CareItem) { setActive(item); setModalOpen(true); }

  function onLogged(id: string, date: string, nextCheckin: string, health: CustomerHealth) {
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      const days = daysUntilDue(nextCheckin);
      return {
        ...it,
        next_checkin_date: nextCheckin,
        days_until_checkin: days,
        checkin_urgency: urgencyFor(days),
        last_checkin_date: date,
        health,
      };
    }));
  }

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <HeartHandshake className="w-5 h-5 text-gold" />
          <h1 className="text-lg font-bold text-navy">{t.care.title}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t.care.subtitle}</p>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">{t.care.colCustomer}</th>
              <th className="text-left px-4 py-3 font-medium">{t.care.colService}</th>
              <th className="text-left px-4 py-3 font-medium w-[100px]">{t.care.colHealth}</th>
              <th className="text-left px-4 py-3 font-medium w-[120px]">{t.care.colLastCheckin}</th>
              <th className="text-left px-4 py-3 font-medium w-[150px]">{t.care.colNextCheckin}</th>
              <th className="w-[130px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground italic py-12">{t.care.empty}</td></tr>
            ) : rows.map((it) => {
              const u = it.checkin_urgency ? urgencyClasses(it.checkin_urgency) : null;
              return (
                <tr key={it.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{it.customer_name}</div>
                    {it.payment_overdue && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-danger font-semibold mt-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" />{t.care.paymentOverdue}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{it.service_desc}</td>
                  <td className="px-4 py-3">
                    <span className={"inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide " + HEALTH_BADGE[it.health]}>
                      {healthLabel[it.health]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {it.last_checkin_date ? fmtDate(it.last_checkin_date) : t.care.never}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {it.days_until_checkin == null ? (
                      <span className="text-muted-foreground">{t.care.notScheduled}</span>
                    ) : (
                      <span className={"font-semibold " + (u ? u.text : "")}>
                        {localizedDaysLabel(it.days_until_checkin, t)}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => openLog(it)} className="border-gold text-navy hover:bg-gold/10 h-8">
                      <HeartHandshake className="w-3.5 h-3.5 mr-1" />{t.care.logCheckin}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <LogCheckInModal open={modalOpen} onOpenChange={setModalOpen} item={active} onLogged={onLogged} />
    </div>
  );
}
