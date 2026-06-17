"use client";

import { useEffect, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLang } from "@/components/LangProvider";
import { fmtMoney } from "@/lib/format";
import { CAPITAL_CATEGORIES } from "@/lib/categories";
import type { ClaimRow } from "@/lib/types";
import { markClaimPaid } from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  claim: ClaimRow | null;
  onPaid: (claimId: string) => void;
};

/**
 * Mark-claim-paid dialog. Default cascades an operating expense; tick
 * "capital expense" to route it to the Capital Pool under a capital
 * category instead.
 */
export function MarkClaimPaidModal({ open, onOpenChange, claim, onPaid }: Props) {
  const { t } = useLang();
  const [capital, setCapital] = useState(false);
  const [capCategory, setCapCategory] = useState<string>("other");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) { setCapital(false); setCapCategory("other"); setError(null); }
  }, [open]);

  function confirm() {
    if (!claim) return;
    setError(null);
    startTransition(async () => {
      try {
        await markClaimPaid(claim.id, capital ? { capital: true, capitalCategory: capCategory } : undefined);
        onPaid(claim.id);
        onOpenChange(false);
      } catch (e) { setError((e as Error).message); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.claims.markPaidTitle}</DialogTitle>
        </DialogHeader>

        {claim && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{claim.claimant}</div>
                <div className="text-xs text-muted-foreground truncate">{claim.item_desc}</div>
              </div>
              <span className="tabular-nums font-semibold text-danger shrink-0 ml-3">{fmtMoney(claim.amount)}</span>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={capital} onChange={(e) => setCapital(e.target.checked)} className="mt-0.5 accent-navy" />
              <span>
                <span className="text-sm font-medium">{t.claims.markPaidCapital}</span>
                <span className="block text-[11px] text-muted-foreground">{t.claims.markPaidCapitalHint}</span>
              </span>
            </label>

            {capital && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t.claims.markPaidCapitalCategory}</Label>
                <select value={capCategory} onChange={(e) => setCapCategory(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {CAPITAL_CATEGORIES.map((c) => <option key={c} value={c}>{t.capitalCat[c]}</option>)}
                </select>
              </div>
            )}

            {error && <div className="text-sm text-destructive">{error}</div>}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>{t.common.cancel}</Button>
          <Button type="button" onClick={confirm} disabled={isPending} className="bg-success hover:bg-success/90 text-white">
            {isPending ? t.common.saving : t.claims.markPaidConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
