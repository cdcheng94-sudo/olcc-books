"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { useLang } from "@/components/LangProvider";
import { cn } from "@/lib/utils";

/**
 * Drop zone + click-to-pick file field. One file at a time.
 *
 * Replaces the bare <input type="file"> in the transaction / claim / mark-paid
 * forms so a receipt can be dragged straight in from the desktop. Deliberately
 * no `capture` attribute — that hint sends some Android browsers straight to
 * the camera, which makes PDFs unpickable.
 */
type Props = {
  value: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDrop({ value, onChange, accept = "image/*,application/pdf", disabled, className }: Props) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function take(list: FileList | null | undefined) {
    const f = list?.[0];
    if (f) onChange(f);
  }
  function open() { if (!disabled) inputRef.current?.click(); }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      onDragOver={(e) => { if (disabled) return; e.preventDefault(); setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => { if (disabled) return; e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      className={cn(
        "flex items-center gap-2.5 rounded-md border border-dashed px-3 py-2.5 text-sm transition-colors select-none",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        over ? "border-gold bg-gold/[0.08]" : "border-input hover:border-navy/40 hover:bg-muted/30",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { take(e.target.files); e.target.value = ""; }}
      />
      {value ? (
        <>
          <FileText className="w-4 h-4 text-navy shrink-0" />
          <span className="min-w-0 flex-1 truncate">{value.name}</span>
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{fmtSize(value.size)}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
            title={t.common.removeFile}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <>
          <UploadCloud className={cn("w-4 h-4 shrink-0", over ? "text-gold" : "text-muted-foreground")} />
          <span className="text-muted-foreground">{over ? t.common.dropNow : t.common.dropOrClick}</span>
        </>
      )}
    </div>
  );
}
