"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/components/LangProvider";
import { todayIso } from "@/lib/format";
import { CLAIM_CATEGORIES } from "@/lib/categories";
import { uploadReceiptToDrive } from "@/lib/upload-receipt";
import type { ClaimRow } from "@/lib/types";
import { createClaim, updateClaim } from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ClaimRow | null;
  onSaved: (row: ClaimRow) => void;
};

export function ClaimFormModal({ open, onOpenChange, editing, onSaved }: Props) {
  const { t } = useLang();
  const [date,       setDate]       = useState(todayIso());
  const [claimant,   setClaimant]   = useState("");
  const [itemDesc,   setItemDesc]   = useState("");
  const [amount,     setAmount]     = useState("");
  const [category,   setCategory]   = useState<string>(CLAIM_CATEGORIES[0]);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState("");
  const [file,       setFile]       = useState<File | null>(null);
  const [note,       setNote]       = useState("");
  const [error,      setError]      = useState<string | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFile(null);
    setUploading(false);
    if (editing) {
      setDate(editing.date);
      setClaimant(editing.claimant);
      setItemDesc(editing.item_desc);
      setAmount(String(editing.amount));
      setCategory(editing.category);
      setExistingReceiptUrl(editing.receipt_url || "");
      setNote(editing.note || "");
    } else {
      setDate(todayIso());
      setClaimant(""); setItemDesc(""); setAmount("");
      setCategory(CLAIM_CATEGORIES[0]); setExistingReceiptUrl(""); setNote("");
    }
  }, [open, editing]);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        // 1. write the row first (keep any existing receipt link on edit)
        const payload = {
          date,
          claimant,
          item_desc:   itemDesc,
          amount:      Number(amount),
          category,
          receipt_url: editing ? (existingReceiptUrl || undefined) : undefined,
          note:        note || undefined,
        };
        const saved = (editing
          ? await updateClaim(editing.id, payload)
          : await createClaim(payload)) as ClaimRow;

        // 2. if a new receipt file is attached, upload it to Google Drive
        if (file) {
          setUploading(true);
          const res = await uploadReceiptToDrive({
            file,
            category: "Claims",
            linkedTable: "claims",
            linkedId: saved.id,
            dateIso: date,
            party: claimant.trim() || null,
            docType: "claim",
          });
          setUploading(false);
          if (res.ok) {
            saved.receipt_url = res.webViewLink;
          } else {
            const msg = res.kind === "auth"  ? t.tx.driveAuthErr
                      : res.kind === "quota" ? t.tx.driveQuotaErr
                      : t.tx.driveUploadErr;
            alert(msg);
          }
        }
        onSaved(saved);
      } catch (e) {
        setUploading(false);
        setError((e as Error).message);
      }
    });
  }

  const busy = isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t.claims.dialogEdit : t.claims.dialogNew}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t.claims.formDate}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t.claims.formCategory}</Label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              {CLAIM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-xs">{t.claims.formClaimant}</Label>
            <Input value={claimant} onChange={(e) => setClaimant(e.target.value)} placeholder={t.claims.formClaimantPlaceholder} required />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-xs">{t.claims.formItem}</Label>
            <Input value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} placeholder={t.claims.formItemPlaceholder} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t.claims.formAmount}</Label>
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t.claims.formReceipt}</Label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-2 file:rounded-md file:border-0 file:bg-navy file:px-2.5 file:py-1.5 file:text-white hover:file:bg-navy-light"
            />
            {editing && existingReceiptUrl && !file && (
              <a href={existingReceiptUrl} target="_blank" rel="noreferrer" title={t.tx.openInDrive}
                className="text-[11px] text-muted-foreground hover:text-navy underline inline-flex items-center gap-0.5 mt-0.5">
                {t.claims.receiptLink} <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-xs">{t.claims.formNote}</Label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
          {error && <div className="col-span-2 text-sm text-destructive">{error}</div>}
          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>{t.common.cancel}</Button>
            <Button type="submit" disabled={busy} className="bg-navy hover:bg-navy-light text-white">
              {uploading ? t.tx.uploadingReceipt : isPending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
