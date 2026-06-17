import { createClient } from "@/lib/supabase/server";
import { listCareItems } from "@/lib/queries/care";
import { CareClient } from "./CareClient";

export default async function CarePage() {
  const supabase = await createClient();
  const items = await listCareItems(supabase);
  return <CareClient initialItems={items} />;
}
