import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { fmtMoney } from "@/lib/format";
import { daysUntilDue, daysLabel } from "@/lib/recurring-utils";
import { getSettings } from "@/lib/queries/settings";
import { sendSubscriptionReminder, sendRecurringDigest } from "@/lib/email";
import type { RecurringRow, SubscriptionRow } from "@/lib/types";

/**
 * Daily reminder cron — Vercel hits this at 01:00 UTC (= 09:00 MYT) every
 * day per vercel.json. Two parallel loops:
 *
 *   - SUBSCRIPTIONS (customers pay us): for each active row whose next
 *     charge is within `remind_days_before`, send a polite chase email
 *     to the customer.
 *
 *   - RECURRING (we pay vendors): roll into a single digest email to
 *     the OLCC team listing everything due soon, so they remember to
 *     settle and mark paid.
 *
 * Auth: Vercel cron requests include `Authorization: Bearer <CRON_SECRET>`.
 * Set CRON_SECRET in the project env vars and we 401 anything else.
 *
 * Uses the SERVICE ROLE supabase client because there's no human session
 * during a cron run — RLS bypass is intentional and scoped to read-only.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

export async function GET(request: Request) {
  // 1. Authorize
  const expected = process.env.CRON_SECRET;
  const got      = request.headers.get("authorization") || "";
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (got !== `Bearer ${expected}`) return unauthorized();

  // 2. Service-role Supabase client (no user session in cron context)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  const supabase = createServiceClient(url, key, { auth: { persistSession: false } });

  const settings = await getSettings(supabase);
  const currency = settings.currency || "MYR";

  // 3. SUBSCRIPTIONS — chase customers
  const { data: subs, error: subErr } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("status", "active");
  if (subErr) return NextResponse.json({ error: `subs: ${subErr.message}` }, { status: 500 });

  let subSent = 0;
  const subErrors: string[] = [];
  for (const s of (subs || []) as SubscriptionRow[]) {
    if (!s.customer_email) continue;
    const days = daysUntilDue(s.next_charge_date);
    if (days > s.remind_days_before) continue;     // not yet in reminder window

    try {
      await sendSubscriptionReminder({
        to:        s.customer_email,
        customer:  s.customer_name,
        service:   s.service_desc,
        amount:    fmtMoney(s.amount, currency),
        dueDate:   s.next_charge_date,
        daysLabel: daysLabel(days),
        bankInfo: {
          name:      settings.bank_name,
          account:   settings.bank_account_name,
          accountNo: settings.bank_account_no,
        },
      });
      subSent++;
    } catch (e) {
      subErrors.push(`${s.customer_name}: ${(e as Error).message}`);
    }
  }

  // 4. RECURRING — heads-up digest to the team
  const { data: rec, error: recErr } = await supabase
    .from("recurring")
    .select("*")
    .eq("status", "active");
  if (recErr) return NextResponse.json({ error: `recurring: ${recErr.message}` }, { status: 500 });

  const dueRecurring = ((rec || []) as RecurringRow[])
    .map((r) => ({ row: r, days: daysUntilDue(r.next_due_date) }))
    .filter(({ row, days }) => days <= row.remind_days_before)
    .map(({ row, days }) => ({
      name:      row.name,
      payee:     row.payee || "—",
      amount:    fmtMoney(row.amount, currency),
      dueDate:   row.next_due_date,
      daysLabel: daysLabel(days),
    }));

  let teamSent = 0;
  let teamError: string | null = null;
  if (dueRecurring.length > 0 && settings.company_email) {
    try {
      await sendRecurringDigest({ to: settings.company_email, items: dueRecurring });
      teamSent = 1;
    } catch (e) {
      teamError = (e as Error).message;
    }
  }

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    subscriptions: {
      considered: (subs || []).length,
      sent:       subSent,
      errors:     subErrors,
    },
    recurring: {
      considered:  (rec || []).length,
      due_count:   dueRecurring.length,
      digest_sent: teamSent,
      error:       teamError,
    },
  });
}
