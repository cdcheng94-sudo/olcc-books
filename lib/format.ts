/**
 * Common formatters used across both server and client. No React,
 * no browser APIs — safe to import anywhere.
 */

export function fmtMoney(amount: number | string | null | undefined, currency: string = "MYR"): string {
  const n = Number(amount) || 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}${currency} ${abs.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "";
  const day = date.getDate();
  return `${day < 10 ? "0" + day : day}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

export function todayIso(): string {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0" + m : m}-${day < 10 ? "0" + day : day}`;
}

export function isoMonth(d?: Date): string {
  const date = d || new Date();
  const m = date.getMonth() + 1;
  return `${date.getFullYear()}-${m < 10 ? "0" + m : m}`;
}

export function ymOf(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "";
  const m = date.getMonth() + 1;
  return `${date.getFullYear()}-${m < 10 ? "0" + m : m}`;
}
