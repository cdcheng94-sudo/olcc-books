"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  ReceiptText,
  RefreshCw,
  Repeat2,
  HeartHandshake,
  GraduationCap,
  Landmark,
  Wallet,
  Settings as SettingsIcon,
} from "lucide-react";
import { useLang } from "@/components/LangProvider";
import type { Dict } from "@/lib/i18n";

const LOGO_URL = "https://raw.githubusercontent.com/cdcheng94-sudo/olcc-assets-circle-png/main/olcc-logo-circle.png";

const NAV: { href: string; key: keyof Dict["nav"]; Icon: React.ComponentType<{ size?: number }>; gold?: boolean }[] = [
  { href: "/dashboard",     key: "dashboard",     Icon: LayoutDashboard },
  { href: "/transactions",  key: "transactions",  Icon: ArrowLeftRight },
  { href: "/invoices",      key: "invoices",      Icon: FileText },
  { href: "/receipts",      key: "receipts",      Icon: ReceiptText },
  { href: "/recurring",     key: "recurring",     Icon: RefreshCw },
  { href: "/subscriptions", key: "subscriptions", Icon: Repeat2 },
  { href: "/care",          key: "care",          Icon: HeartHandshake },
  { href: "/eduflow",       key: "eduflow",       Icon: GraduationCap, gold: true },
  { href: "/capital",       key: "capital",       Icon: Landmark },
  { href: "/claims",        key: "claims",        Icon: Wallet },
  { href: "/settings",      key: "settings",      Icon: SettingsIcon },
];

type SidebarProps = {
  userEmail?: string | null;
  mobileOpen?: boolean;
  onClose?: () => void;
};

export function Sidebar({ userEmail, mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLang();

  return (
    <>
      {/* backdrop (mobile only, when drawer open) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "fixed left-0 top-0 h-screen w-60 flex flex-col bg-primary text-white",
          "shadow-[2px_0_20px_rgba(15,39,71,0.15)] z-50",
          "transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0 md:z-40",
        ].join(" ")}
      >
      {/* brand block */}
      <div className="px-5 py-6 border-b border-primary-light">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
            <Image
              src={LOGO_URL}
              alt="OLCC"
              width={44}
              height={44}
              className="w-full h-full object-cover"
              unoptimized
              priority
            />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">OLCC</div>
            <div className="text-[10px] tracking-widest text-gold-light">TECHNOLOGY</div>
          </div>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {NAV.map(({ href, key, Icon, gold }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={[
                "flex items-center gap-3 px-3.5 py-2.5 mb-1 rounded-lg text-sm transition-colors",
                "border-l-[3px]",
                active
                  ? "bg-primary-light text-white font-semibold border-gold"
                  : "text-white/65 hover:text-white hover:bg-primary-light/50 border-transparent",
              ].join(" ")}
            >
              <Icon size={18} />
              <span className={gold && !active ? "text-gold-light/90" : ""}>{t.nav[key]}</span>
            </Link>
          );
        })}
      </nav>

      {/* user pill */}
      {userEmail && (
        <div className="px-4 py-4 border-t border-primary-light">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gold text-primary-deep flex items-center justify-center font-bold text-xs">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <span className="text-white/80 text-xs truncate">{userEmail}</span>
          </div>
        </div>
      )}
      </aside>
    </>
  );
}
