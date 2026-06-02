import { createClient } from "@/lib/supabase/server";
import { listSubscriptions } from "@/lib/queries/subscriptions";
import { SubscriptionsClient } from "./SubscriptionsClient";

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const rows = await listSubscriptions(supabase);
  return <SubscriptionsClient initialRows={rows} />;
}
