"use client";

import { useState, useTransition } from "react";
import { Building2, Landmark, FileText, Users, Trash2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Settings } from "@/lib/queries/settings";
import type { AllowedEmailRow } from "@/lib/types";
import { updateSettings, addAllowedEmail, removeAllowedEmail } from "./actions";

type Props = {
  settings:     Settings;
  allowed:      AllowedEmailRow[];
  currentEmail: string;
};

export function SettingsClient({ settings, allowed: initialAllowed, currentEmail }: Props) {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold">Settings</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Anything edited here flows straight into the next PDF, email, and dashboard render.
        </p>
      </div>

      <CompanySection initial={settings} />
      <BankSection    initial={settings} />
      <DocsSection    initial={settings} />
      <AllowedEmailsSection initial={initialAllowed} currentEmail={currentEmail} />
    </div>
  );
}

// ---------- Company info ----------

function CompanySection({ initial }: { initial: Settings }) {
  const [name,     setName]     = useState(initial.company_name);
  const [address,  setAddress]  = useState(initial.company_address);
  const [taxId,    setTaxId]    = useState(initial.company_tax_id);
  const [phone,    setPhone]    = useState(initial.company_phone);
  const [email,    setEmail]    = useState(initial.company_email);
  const [logoUrl,  setLogoUrl]  = useState(initial.logo_url);
  const [saved, setSaved]   = useState<"idle" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setSaved("idle"); setErrMsg(null);
    startTransition(async () => {
      try {
        await updateSettings({
          company_name:    name,
          company_address: address,
          company_tax_id:  taxId,
          company_phone:   phone,
          company_email:   email,
          logo_url:        logoUrl,
        });
        setSaved("ok");
      } catch (e) { setSaved("err"); setErrMsg((e as Error).message); }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Building2 size={18} className="text-gold" />
        <CardTitle className="text-sm font-bold">Company info</CardTitle>
        {saved === "ok"  && <span className="ml-auto text-xs text-success">Saved ✓</span>}
        {saved === "err" && <span className="ml-auto text-xs text-destructive">{errMsg}</span>}
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Company name"          value={name}     onChange={setName} required />
          <Field label="Tax ID / Reg no."      value={taxId}    onChange={setTaxId} />
          <Field label="Phone"                 value={phone}    onChange={setPhone} />
          <Field label="Contact email"         value={email}    onChange={setEmail} type="email" />
          <Field label="Address" wide          value={address}  onChange={setAddress} />
          <Field label="Logo URL" wide         value={logoUrl}  onChange={setLogoUrl} placeholder="https://..." />
          <div className="md:col-span-2 flex justify-end pt-1">
            <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-light text-white">
              {isPending ? "Saving…" : "Save company info"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------- Bank info ----------

function BankSection({ initial }: { initial: Settings }) {
  const [bankName,   setBankName]   = useState(initial.bank_name);
  const [accName,    setAccName]    = useState(initial.bank_account_name);
  const [accNo,      setAccNo]      = useState(initial.bank_account_no);
  const [saved, setSaved] = useState<"idle" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setSaved("idle"); setErrMsg(null);
    startTransition(async () => {
      try {
        await updateSettings({
          bank_name:          bankName,
          bank_account_name:  accName,
          bank_account_no:    accNo,
        });
        setSaved("ok");
      } catch (e) { setSaved("err"); setErrMsg((e as Error).message); }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Landmark size={18} className="text-gold" />
        <CardTitle className="text-sm font-bold">Bank info (shown on invoices)</CardTitle>
        {saved === "ok"  && <span className="ml-auto text-xs text-success">Saved ✓</span>}
        {saved === "err" && <span className="ml-auto text-xs text-destructive">{errMsg}</span>}
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Bank name"      value={bankName} onChange={setBankName} />
          <Field label="Account no."    value={accNo}    onChange={setAccNo} />
          <Field label="Account name" wide value={accName} onChange={setAccName} />
          <div className="md:col-span-2 flex justify-end pt-1">
            <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-light text-white">
              {isPending ? "Saving…" : "Save bank info"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------- Document settings ----------

function DocsSection({ initial }: { initial: Settings }) {
  const [currency, setCurrency] = useState(initial.currency);
  const [taxRate,  setTaxRate]  = useState(String(initial.tax_rate));
  const [invPrefix, setInvPrefix] = useState(initial.invoice_prefix);
  const [rcpPrefix, setRcpPrefix] = useState(initial.receipt_prefix);
  const [nextInv, setNextInv] = useState(String(initial.next_invoice_seq));
  const [nextRcp, setNextRcp] = useState(String(initial.next_receipt_seq));
  const [saved, setSaved] = useState<"idle" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setSaved("idle"); setErrMsg(null);
    startTransition(async () => {
      try {
        await updateSettings({
          currency,
          tax_rate:         taxRate,
          invoice_prefix:   invPrefix,
          receipt_prefix:   rcpPrefix,
          next_invoice_seq: nextInv,
          next_receipt_seq: nextRcp,
        });
        setSaved("ok");
      } catch (e) { setSaved("err"); setErrMsg((e as Error).message); }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <FileText size={18} className="text-gold" />
        <CardTitle className="text-sm font-bold">Document numbering & currency</CardTitle>
        {saved === "ok"  && <span className="ml-auto text-xs text-success">Saved ✓</span>}
        {saved === "err" && <span className="ml-auto text-xs text-destructive">{errMsg}</span>}
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Currency code"      value={currency}  onChange={setCurrency} placeholder="MYR" />
          <Field label="Default tax (%)"    value={taxRate}   onChange={setTaxRate}  type="number" />
          <Field label="Invoice prefix"     value={invPrefix} onChange={setInvPrefix} placeholder="INV" />
          <Field label="Receipt prefix"     value={rcpPrefix} onChange={setRcpPrefix} placeholder="RCP" />
          <Field label="Next invoice no."   value={nextInv}   onChange={setNextInv} type="number" />
          <Field label="Next receipt no."   value={nextRcp}   onChange={setNextRcp} type="number" />
          <div className="md:col-span-2 text-[11px] text-muted-foreground">
            Tip: edit "Next invoice no." to reset the counter (e.g. back to 1 after wiping test data).
          </div>
          <div className="md:col-span-2 flex justify-end pt-1">
            <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-light text-white">
              {isPending ? "Saving…" : "Save numbering"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------- Allowed emails ----------

function AllowedEmailsSection({ initial, currentEmail }: { initial: AllowedEmailRow[]; currentEmail: string }) {
  const [rows, setRows] = useState<AllowedEmailRow[]>(initial);
  const [email, setEmail] = useState("");
  const [name,  setName]  = useState("");
  const [err,   setErr]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function add() {
    setErr(null);
    startTransition(async () => {
      try {
        await addAllowedEmail(email, name || undefined);
        setRows((prev) => {
          const lower = email.toLowerCase();
          const existing = prev.find((r) => r.email.toLowerCase() === lower);
          if (existing) return prev.map((r) => r.email.toLowerCase() === lower ? { ...r, name: name || r.name } : r);
          return [...prev, { email: lower, name: name || null, added_at: new Date().toISOString() }];
        });
        setEmail(""); setName("");
      } catch (e) { setErr((e as Error).message); }
    });
  }

  function remove(em: string) {
    if (!confirm(`Revoke access for ${em}? They'll be denied at next login.`)) return;
    setErr(null);
    startTransition(async () => {
      try {
        await removeAllowedEmail(em, currentEmail);
        setRows((prev) => prev.filter((r) => r.email !== em));
      } catch (e) { setErr((e as Error).message); }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Users size={18} className="text-gold" />
        <CardTitle className="text-sm font-bold">Who can sign in</CardTitle>
        <span className="ml-auto text-[11px] text-muted-foreground">{rows.length} {rows.length === 1 ? "person" : "people"}</span>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {rows.map((r, i) => {
            const self = r.email.toLowerCase() === currentEmail;
            return (
              <li key={r.email} className={"flex items-center gap-3 py-2 " + (i > 0 ? "border-t border-border" : "")}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {r.email}
                    {self && <span className="ml-2 inline-block bg-success-soft text-success text-[9px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded">you</span>}
                  </div>
                  {r.name && <div className="text-[11px] text-muted-foreground">{r.name}</div>}
                </div>
                <button
                  onClick={() => remove(r.email)}
                  disabled={isPending || self}
                  className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-destructive disabled:opacity-30"
                  title={self ? "You can't remove yourself" : "Revoke access"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>

        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2 mt-4 pt-4 border-t border-border">
          <Input
            type="email"
            placeholder="email@gmail.com (must be a Google account)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1"
          />
          <Input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="w-44" />
          <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-light text-white">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </form>
        {err && <div className="text-xs text-destructive mt-2">{err}</div>}
      </CardContent>
    </Card>
  );
}

// ---------- Tiny reusable field ----------

function Field({
  label, value, onChange, type = "text", placeholder, required, wide,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; wide?: boolean;
}) {
  return (
    <div className={"flex flex-col gap-1 " + (wide ? "md:col-span-2" : "")}>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}
