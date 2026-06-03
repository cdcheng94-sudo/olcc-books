"use client";

import Image from "next/image";
import { Bell, Globe, LogOut, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLang } from "@/components/LangProvider";
import { createClient } from "@/lib/supabase/client";
import type { Dict } from "@/lib/i18n";

const LOGO_URL = "https://raw.githubusercontent.com/cdcheng94-sudo/olcc-assets-circle-png/main/olcc-logo-circle.png";

const TITLE_KEYS: Record<string, keyof Dict["nav"]> = {
  "/dashboard":     "dashboard",
  "/transactions":  "transactions",
  "/invoices":      "invoices",
  "/receipts":      "receipts",
  "/recurring":     "recurring",
  "/subscriptions": "subscriptions",
  "/eduflow":       "eduflow",
  "/capital":       "capital",
  "/claims":        "claims",
  "/settings":      "settings",
};

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { t, lang, toggle } = useLang();
  const pathname = usePathname();

  const key = Object.keys(TITLE_KEYS).find((k) => pathname.startsWith(k));
  const title = key ? t.nav[TITLE_KEYS[key]] : "";

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-card border-b flex items-center justify-between px-4 sm:px-6 md:px-7">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* hamburger — mobile only */}
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden flex items-center justify-center w-9 h-9 -ml-1 rounded-md text-navy hover:bg-accent transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        {/* small logo — mobile only (desktop logo lives in the sidebar) */}
        <div className="md:hidden w-8 h-8 rounded-md overflow-hidden bg-primary/5 flex-shrink-0">
          <Image src={LOGO_URL} alt="OLCC" width={32} height={32} className="w-full h-full object-cover" unoptimized />
        </div>
        <h1 className="text-base sm:text-lg font-bold text-foreground m-0 truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-1.5 bg-background border border-border px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold text-navy hover:bg-accent transition-colors"
          aria-label="Toggle language"
        >
          <Globe size={14} />
          {lang === "zh" ? "EN" : "中文"}
        </button>
        <div className="relative hidden sm:block">
          <Bell size={20} className="text-muted-foreground" />
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
