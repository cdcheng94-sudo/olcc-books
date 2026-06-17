"use client";

import { useEffect, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/components/LangProvider";
import { todayIso } from "@/lib/format";
import { CHECKIN_CHANNELS, CHECKIN_HEALTHS, CHECKIN_INTERVALS } from "@/lib/categories";
import type { CareItem } from "@/lib/queries/care";
import type { CustomerHealth } from "@/lib/types";
import { logCheckIn } from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: CareItem | null;
  onLogged: (id: string, date: string, next_checkin_date: string, health: CustomerHealth) => void;
};

export function LogCheckInModal({ open, onOpenChange, item, onLogged }: Props) {
  const { t } = useLang();
  const [date,     setDate]     = useState(todayIso());
  const [channel,  setChannel]  = useState<string>("whatsapp");
  const [health,   setHealth]   = useState<string>("healthy");
  const [feedback, setFeedback] = useState("");
  const [nextInterval, setNextInterval] = useState<number>(7);
  const [error,    setError]    = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !item) return;
    setDate(todayIso());
    setChannel("whatsapp");
    setHealth(item.health || "healthy");
    setFeedback("");
    setNextInterval(item.checkin_interval_days || 7);
    setError(null);
  }, [open, item]);

  const channelLabel: Record<string, string> = {
    call: t.care.chCall, whatsapp: t.care.chWhatsapp, visit: t.care.chVisit, email: t.care.chEmail, other: t.care.chOther,
  };
  const healthLabel: Record<string, string> = {
    healthy: t.care.healthHealthy, watch: t.care.healthWatch, at_risk: t.care.healthAtRisk,
  };

  function save() {
    if (!item) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await logCheckIn({
          subscription_id: item.id,
          date,
          channel,
          health,
          feedback: feedback || undefined,
          next_interval_days: nextInterval,
        });
        onLogged(item.id, date, res.next_checkin_date, res.health as CustomerHealth);
        onOpenChange(false);
      } catch (e) { setError((e as Error).message); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.care.dialogTitle}</DialogTitle>
        </DialogHeader>

        {item && (
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid grid-cols-2 gap-3">
            <div className="col-span-2 rounded-md bg-muted/40 px-3 py-2">
              <div className="font-semibold text-sm">{item.customer_name}</div>
              <div className="text-xs text-muted-foreground">{item.service_desc}</div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.care.fieldDate}</Label>
              <Input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.care.fieldChannel}</Label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                {CHECKIN_CHANNELS.map((c) => <option key={c} value={c}>{channelLabel[c]}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-xs">{t.care.fieldHealth}</Label>
              <div className="flex gap-2">
                {CHECKIN_HEALTHS.map((h) => (
                  <button key={h} type="button" onClick={() => setHealth(h)}
                    className={"flex-1 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors " +
                      (health === h
                        ? (h === "healthy" ? "bg-success-soft text-success border-success"
                          : h === "watch" ? "bg-warning-soft text-warning border-warning"
                          : "bg-danger-soft text-danger border-danger")
                        : "bg-card text-muted-foreground border-border hover:text-navy")}>
                    {healthLabel[h]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-xs">{t.care.fieldFeedback}</Label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder={t.care.fieldFeedbackPlaceholder}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-xs">{t.care.fieldNextInterval}</Label>
              <div className="flex gap-2">
                {CHECKIN_INTERVALS.map((n) => (
                  <button key={n} type="button" onClick={() => setNextInterval(n)}
                    className={"flex-1 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors " +
                      (nextInterval === n ? "bg-navy text-white border-navy" : "bg-card text-muted-foreground border-border hover:text-navy")}>
                    {n} {t.care.intervalSuffix}
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="col-span-2 text-sm text-destructive">{error}</div>}
            <DialogFooter className="col-span-2 mt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>{t.common.cancel}</Button>
              <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-light text-white">
                {isPending ? t.care.saving : t.common.save}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
