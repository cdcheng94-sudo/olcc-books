import { createClient } from "@/lib/supabase/server";
import { listClaims } from "@/lib/queries/claims";
import { ClaimsClient } from "./ClaimsClient";

export default async function ClaimsPage() {
  const supabase = await createClient();
  const rows = await listClaims(supabase);
  return <ClaimsClient initialRows={rows} />;
}
