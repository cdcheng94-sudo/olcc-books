import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

/**
 * Root entry. Middleware already redirects unauthenticated traffic to
 * /auth/login, so by the time we reach here the user is logged in
 * (or env vars aren't set yet during local dev — in which case we send
 * them to the login page anyway so they see the setup hint).
 */
export default async function Home() {
  if (!hasEnvVars) {
    redirect("/auth/login");
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/auth/login");
  }
  redirect("/dashboard");
}
