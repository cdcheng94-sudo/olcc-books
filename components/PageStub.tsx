"use client";

import { useLang } from "@/components/LangProvider";
import { Card, CardContent } from "@/components/ui/card";
import type { Dict } from "@/lib/i18n";

/**
 * Placeholder card for not-yet-built pages. Drop into a `page.tsx`
 * and pass the i18n nav key — the title localizes automatically.
 * Replace each stub with the real implementation as the corresponding
 * phase comes up (see OLCC-Books-2.0-网页版开发文档.md §9).
 */
export function PageStub({ titleKey }: { titleKey: keyof Dict["nav"] }) {
  const { t } = useLang();
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <h2 className="text-lg text-muted-foreground font-medium mb-2">{t.nav[titleKey]}</h2>
        <p className="text-xs text-muted-foreground">
          Coming soon — this page will be built in a later phase.
        </p>
      </CardContent>
    </Card>
  );
}
