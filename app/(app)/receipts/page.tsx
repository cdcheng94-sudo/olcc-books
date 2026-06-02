import { createClient } from "@/lib/supabase/server";
import { listReceipts } from "@/lib/queries/receipts";
import { ReceiptsClient } from "./ReceiptsClient";

export default async function ReceiptsPage() {
  const supabase = await createClient();
  const rows = await listReceipts(supabase);
  return <ReceiptsClient initialRows={rows} />;
}
