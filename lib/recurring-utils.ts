/**
 * Shared logic used by both /recurring (we pay outwards) and /subscriptions
 * (customers pay us). Date arithmetic, urgency banding, frequency advance —
 * one source of truth instead of two.
 */

export type Frequency = "monthly" | "quarterly" | "yearly";
export type Urgency = "comfortable" | "caution" | "urgent" | "overdue";

/** Days from today to a target ISO date. Negative = overdue. Today = 0. */
export function daysUntilDue(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + "T00:00:00");
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

/** Map days-until-due into a color band (matches v1 dashboard convention). */
export function urgencyFor(days: number): Urgency {
  if (days < 0)  return "overdue";
  if (days <= 3) return "urgent";
  if (days <= 7) return "caution";
  return "comfortable";
}

/** Human-readable label (English-only for now; bilingual happens client-side). */
export function daysLabel(days: number): string {
  if (days < 0) {
    const n = Math.abs(days);
    return `${n} day${n === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

/** Push a date forward by the given frequency, returning a fresh ISO date. */
export function advanceDate(isoDate: string, freq: Frequency): string {
  const d = new Date(isoDate + "T00:00:00");
  if (freq === "monthly")        d.setMonth(d.getMonth() + 1);
  else if (freq === "quarterly") d.setMonth(d.getMonth() + 3);
  else                           d.setFullYear(d.getFullYear() + 1);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${m < 10 ? "0" + m : m}-${day < 10 ? "0" + day : day}`;
}

/** Tailwind class fragments for a given urgency band. Use on `.reminder-card`. */
export function urgencyClasses(u: Urgency) {
  switch (u) {
    case "overdue":     return { border: "border-l-[#7f1d1d]", bg: "bg-red-50",      text: "text-[#7f1d1d]",   bar: "bg-[#7f1d1d]"    };
    case "urgent":      return { border: "border-l-destructive", bg: "",             text: "text-destructive", bar: "bg-destructive"  };
    case "caution":     return { border: "border-l-warning",    bg: "",              text: "text-warning",     bar: "bg-warning"      };
    case "comfortable": return { border: "border-l-success",    bg: "",              text: "text-success",     bar: "bg-success"      };
  }
}

/** Sort overdue first, then by soonest due. Stable. */
export function sortByDueDate<T extends { days_until_due: number; urgency: Urgency }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.urgency === "overdue" && b.urgency !== "overdue") return -1;
    if (b.urgency === "overdue" && a.urgency !== "overdue") return  1;
    return a.days_until_due - b.days_until_due;
  });
}

export const FREQUENCIES: readonly Frequency[] = ["monthly", "quarterly", "yearly"] as const;
