"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Settings page server actions. The settings table is key-value, so each
 * update is just an upsert. We surface three groups (company, bank, doc
 * numbering) as separate forms to keep the partial-saves clear.
 *
 * Allowed emails get their own add/remove handlers.
 */

type StringMap = Record<string, string>;

export async function updateSettings(values: StringMap) {
  const supabase = await createClient();
  const rows = Object.entries(values).map(([key, value]) => ({ key, value: String(value ?? "") }));
  if (rows.length === 0) return { ok: true };
  const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);

  // Settings touch every PDF render and the cron digest — revalidate broadly.
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath("/receipts");
  return { ok: true };
}

export async function addAllowedEmail(email: string, name?: string) {
  const cleaned = email.trim().toLowerCase();
  if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    throw new Error("Enter a valid email address.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("allowed_emails")
    .upsert({ email: cleaned, name: name?.trim() || null }, { onConflict: "email" });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeAllowedEmail(email: string, currentUserEmail: string) {
  const cleaned = email.trim().toLowerCase();
  if (cleaned === currentUserEmail.trim().toLowerCase()) {
    throw new Error("You cannot remove your own access from inside the app.");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("allowed_emails").delete().eq("email", cleaned);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  return { ok: true };
}
