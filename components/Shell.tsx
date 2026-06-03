"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

/**
 * App chrome wrapper. Holds the mobile-drawer open state so the TopBar's
 * hamburger and the Sidebar drawer share it. On md+ the sidebar is a fixed
 * column (drawer state ignored); below md it slides in over a backdrop.
 */
export function Shell({ userEmail, reminderCount = 0, children }: { userEmail?: string | null; reminderCount?: number; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-svh bg-background flex">
      <Sidebar userEmail={userEmail} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 md:ml-60 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setMobileOpen(true)} reminderCount={reminderCount} />
        <main className="flex-1 px-4 sm:px-6 md:px-7 py-6 md:py-7 max-w-[1180px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
