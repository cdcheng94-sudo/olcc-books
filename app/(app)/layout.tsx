import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";

/**
 * Shell for all authenticated app pages. Wraps every route under app/(app)/
 * with the sidebar + top bar and enforces two access gates:
 *   1. Must be logged in (middleware also checks this, double-belt)
 *   2. Email must appear in the `allowed_emails` table (whitelist)
 *
 * If allowed_emails is empty we treat the app as "first-run" and allow
 * anyone logged in through — useful when the owner self-bootstraps.
 * After at least one row exists, the whitelist is enforced.
 */
export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const email = (user.email || "").toLowerCase();
  const { count } = await supabase
    .from("allowed_emails")
    .select("*", { count: "exact", head: true });

  if ((count ?? 0) > 0) {
    const { data: allowed } = await supabase
      .from("allowed_emails")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (!allowed) {
      return (
        <div className="min-h-svh flex items-center justify-center p-6"
             style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-light)) 100%)" }}>
          <div className="bg-card rounded-xl p-8 max-w-sm text-center shadow-2xl">
            <div className="text-xs tracking-widest text-gold font-bold uppercase mb-2">OLCC Books</div>
            <h1 className="text-lg font-semibold text-navy mb-2">No access</h1>
            <p className="text-sm text-muted-foreground mb-4">
              <strong>{email}</strong> is not on the allowed list.
            </p>
            <p className="text-xs text-muted-foreground">
              Contact your administrator to be added.
            </p>
            <form action="/auth/logout" method="post" className="mt-6">
              <button type="submit" className="text-xs text-muted-foreground hover:text-destructive underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      );
    }
  }

  return <Shell userEmail={email}>{children}</Shell>;
}
