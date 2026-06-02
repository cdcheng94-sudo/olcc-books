"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Image from "next/image";

/**
 * OLCC Books login. Single sign-in path: Google OAuth via Supabase.
 * Custom email/password is deliberately not offered — partners use their
 * existing Google identity, and access is gated by the allowed_emails
 * table (checked in the (app) layout after login).
 */
export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success, the browser is redirected to Google's consent screen,
    // so loading state intentionally stays true while we navigate away.
  }

  return (
    <div className="min-h-svh w-full flex items-center justify-center p-6"
         style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-light)) 100%)" }}>
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="flex flex-col items-center gap-3 pt-8 pb-4">
          <Image
            src="https://raw.githubusercontent.com/cdcheng94-sudo/olcc-assets-circle-png/main/olcc-logo-circle.png"
            alt="OLCC"
            width={64}
            height={64}
            className="rounded-lg"
            unoptimized
          />
          <div className="text-center">
            <div className="text-xs tracking-widest text-gold font-bold uppercase">OLCC Books</div>
            <h1 className="text-xl font-semibold text-navy mt-1">Sign in</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Use the Google account on the OLCC allowed list.
            </p>
          </div>
        </CardHeader>
        <CardContent className="pb-8">
          <Button
            type="button"
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full bg-navy hover:bg-navy-light text-white"
            size="lg"
          >
            {loading ? "Redirecting…" : "Continue with Google"}
          </Button>
          {error && (
            <p className="text-sm text-destructive mt-3 text-center">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
