"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLang } from "@/components/LangProvider";
import { fmtMoney } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/categories";
import { uploadReceiptToDrive } from "@/lib/upload-receipt";
import type { InvoiceRow } from "@/lib/types";
import { markInvoicePaid } from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: InvoiceRow | null;
  onPaid: (invoiceId: string) => void;
};

/**
 * Mark-Paid dialog: pick the payment method and, if the customer sent a
 * payment receipt / transfer screenshot, attach it. The proof file is
 * uploaded to Google Drive against the income transaction the cascade
 * creates (receipt_url on that transaction).
 */
export function MarkPaidModal({ open, onOpenChange, invoice, onPaid }: Props) {
  const { t } = useLang();
  const [method, setMethod] = useState<string>("Bank Transfer");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) { setMethod("Bank Transfer"); setFile(null); setUploading(false); }
  }, [open]);

  function confirm() {
    if (!invoice) return;
    startTransition(async () => {
      try {
        const res = await markInvoicePaid(invoice.id, method);
        // Attach the customer's payment proof (if any) to the income transaction.
        if (file && res.transaction_id) {
          setUploading(true);
          const up = await uploadReceiptToDrive({
            file,
            category: "Receipts",
            linkedTable: "transactions",
            linkedId: res.transaction_id,
            dateIso: res.date,
            party: res.customer_name,
            docType: "payment",
          });
          setUploading(false);
          if (!up.ok) alert(t.invoice.markPaidProofFailed);
        }
        onPaid(invoice.id);
        onOpenChange(false);
        alert(t.invoice.markPaidOk);
      } catch (e) {
        setUploading(false);
        alert(t.errors.markPaidFailed + (e as Error).message);
      }
    });
  }

  const busy = isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.invoice.markPaidTitle}</DialogTitle>
        </DialogHeader>

        {invoice && (
          <div className="flex flex-col gap-4">
            {/* summary */}
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span className="font-mono font-medium">{invoice.invoice_number}</span>
              <span className="tabular-nums font-semibold text-success">{fmtMoney(invoice.total)}</span>
            </div>

            {/* payment method */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.invoice.markPaidMethod}</Label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* optional payment proof */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t.invoice.markPaidProof}</Label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-white hover:file:bg-navy-light"
              />
              <p className="text-[11px] text-muted-foreground italic">{t.invoice.markPaidProofHint}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button type="button" onClick={confirm} disabled={busy} className="bg-success hover:bg-success/90 text-white">
            {uploading ? t.tx.uploadingReceipt : isPending ? t.invoice.markPaidProcessing : t.invoice.markPaidConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
