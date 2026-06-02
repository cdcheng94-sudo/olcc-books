import { createClient } from "@/lib/supabase/server";
import { listInvoices } from "@/lib/queries/invoices";
import { InvoicesClient } from "./InvoicesClient";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const rows = await listInvoices(supabase);
  return <InvoicesClient initialRows={rows} />;
}
