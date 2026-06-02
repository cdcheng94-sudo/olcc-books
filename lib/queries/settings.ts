/**
 * Settings is a key-value table. The PDF/email layers need a bunch of
 * keys (company name, bank info, prefixes, counters) every render. Pull
 * them in one go and shape into a typed object for safer consumption.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Settings = {
  company_name:       string;
  company_address:    string;
  company_tax_id:     string;
  company_phone:      string;
  company_email:      string;
  logo_url:           string;
  currency:           string;
  tax_rate:           number;          // percent, e.g. 0 or 8 for SST
  bank_account_name:  string;
  bank_name:          string;
  bank_account_no:    string;
  invoice_prefix:     string;
  receipt_prefix:     string;
  next_invoice_seq:   number;
  next_receipt_seq:   number;
};

const DEFAULTS: Settings = {
  company_name:       "OLCC Technology Sdn Bhd",
  company_address:    "",
  company_tax_id:     "",
  company_phone:      "",
  company_email:      "",
  logo_url:           "",
  currency:           "MYR",
  tax_rate:           0,
  bank_account_name:  "",
  bank_name:          "",
  bank_account_no:    "",
  invoice_prefix:     "INV",
  receipt_prefix:     "RCP",
  next_invoice_seq:   1,
  next_receipt_seq:   1,
};

export async function getSettings(supabase: SupabaseClient): Promise<Settings> {
  const { data, error } = await supabase.from("settings").select("key, value");
  if (error) throw new Error(error.message);

  const out: Record<string, string> = {};
  for (const row of data || []) out[row.key] = row.value;

  return {
    ...DEFAULTS,
    ...Object.fromEntries(
      Object.entries(out).map(([k, v]) => {
        if (k === "tax_rate" || k === "next_invoice_seq" || k === "next_receipt_seq") {
          return [k, Number(v) || 0];
        }
        return [k, v];
      }),
    ),
  } as Settings;
}

export async function setSetting(supabase: SupabaseClient, key: keyof Settings, value: string | number) {
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value: String(value) }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
