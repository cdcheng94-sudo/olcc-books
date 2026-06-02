"use client";

import { Bell, Globe, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLang } from "@/components/LangProvider";
import { createClient } from "@/lib/supabase/client";
import type { Dict } from "@/lib/i18n";

const TITLE_KEYS: Record<string, keyof Dict["nav"]> = {
  "/dashboard":     "dashboard",
  "/transactions":  "transactions",
  "/invoices":      "invoices",
  "/receipts":      "receipts",
  "/recurring":     "recurring",
  "/subscriptions": "subscriptions",
  "/claims":        "claims",
  "/settings":      "settings",
};

export function TopBar() {
  const { t, lang, toggle } = useLang();
  const pathname = usePathname();

  // Resolve current page title from path
  const key = Object.keys(TITLE_KEYS).find((k) => pathname.startsWith(k));
  const title = key ? t.nav[TITLE_KEYS[key]] : "";

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-card border-b flex items-center justify-between px-6 md:px-7">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-foreground m-0">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-1.5 bg-background border border-border px-3 py-1.5 rounded-md text-xs font-semibold text-navy hover:bg-accent transition-colors"
          aria-label="Toggle language"
        >
          <Globe size={14} />
          {lang === "zh" ? "EN" : "中文"}
        </button>
        <div className="relative">
          <Bell size={20} className="text-muted-foreground" />
          {/* badge slot for future notification count */}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Logout"
        >
          <LogOut size={16} />
        </Button>
      </div>
    </header>
  );
}
