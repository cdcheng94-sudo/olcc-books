import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/queries/settings";
import { listAllowedEmails } from "@/lib/queries/allowed-emails";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [{ data: { user } }, settings, allowed] = await Promise.all([
    supabase.auth.getUser(),
    getSettings(supabase),
    listAllowedEmails(supabase),
  ]);

  return (
    <SettingsClient
      settings={settings}
      allowed={allowed}
      currentEmail={(user?.email || "").toLowerCase()}
    />
  );
}
