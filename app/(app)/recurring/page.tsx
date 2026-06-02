import { createClient } from "@/lib/supabase/server";
import { listRecurring } from "@/lib/queries/recurring";
import { RecurringClient } from "./RecurringClient";

export default async function RecurringPage() {
  const supabase = await createClient();
  const rows = await listRecurring(supabase);
  return <RecurringClient initialRows={rows} />;
}
